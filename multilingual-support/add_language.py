#!/usr/bin/env python3
"""
Scaffold a new DeutschPath UI language end-to-end.

Usage:
  python3 multilingual-support/add_language.py --code tr --name Turkish
  python3 multilingual-support/add_language.py --code tr --name Turkish --native "Türkçe" --direction ltr
  python3 multilingual-support/add_language.py --code tr --name Turkish --dry-run

What it does, in order:
  1. Determines script direction (RTL/LTR): checks a small static table of
     well-known languages first (instant, free, deterministic); for anything
     else, asks Gemini and requires you to confirm before proceeding (skip
     both with --direction).
  2. Determines CLDR plural categories the same way (static table, Gemini
     fallback + confirmation, or --plural-categories to skip).
  3. Builds the translation prompt from the template in adding-a-language.md
     (the SAME template a human would use for the manual path — editing it
     there changes what this script sends too) and calls Gemini to generate
     the full frontend/src/messages/<code>.json catalog. Falls back to
     translating namespace-by-namespace if the full-catalog response doesn't
     parse or doesn't structurally match en.json (handles output truncation).
  4. Validates the result in memory (key parity, placeholder integrity, ICU
     plural validity, rich-text tags) BEFORE writing anything to disk. A
     catalog that fails this never reaches frontend/src/messages/ and never
     triggers any of the edits below.
  5. Asks Gemini for the new language's name as written in every existing
     catalog, and vice versa, and merges those into settings.uiLang.names
     across every catalog.
  6. Edits frontend/src/i18n/config.ts (UI_LOCALES, RTL_LOCALES,
     UI_LOCALE_LABELS) — but only after verifying the file's current shape
     exactly matches what this script knows how to parse; aborts with no
     changes to config.ts if it's drifted (see patch_config_ts()).
  7. Adds the language's plural categories to validate_languages.py's
     CLDR_PLURAL_CATEGORIES, using the same shape-assertion-then-edit pattern.
  8. Runs validate_languages.py and `npx tsc --noEmit` and reports the result.

--dry-run performs every step (including the Gemini calls) but never writes
to disk — every planned change is printed instead.

Requires GEMINI_API_KEY in backend/.env (the same key the app already uses).
This is a strong first draft, not a finished translation — always do the
"native speaker skim" step from adding-a-language.md §6 before shipping.
"""
import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
MESSAGES_DIR = REPO_ROOT / "frontend/src/messages"
CONFIG_TS_PATH = REPO_ROOT / "frontend/src/i18n/config.ts"
VALIDATE_SCRIPT_PATH = SCRIPT_DIR / "validate_languages.py"
PROMPT_DOC_PATH = SCRIPT_DIR / "adding-a-language.md"
EN_PATH = MESSAGES_DIR / "en.json"

MODEL = "gemini-2.5-flash"

# ── Cross-platform safety (Windows) ────────────────────────────────────────────
# `npx` resolves to `npx.cmd` on Windows; passing bare "npx" to subprocess there
# fails with WinError 2 because the .cmd extension isn't auto-resolved.
NPX = "npx.cmd" if os.name == "nt" else "npx"
# This script prints native language names (e.g. اردو, Türkçe) to stdout; a
# legacy (non-UTF-8) Windows console would raise UnicodeEncodeError on them.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Load validate_languages.py as a module so regexes/helpers aren't duplicated ──
_spec = importlib.util.spec_from_file_location("validate_languages", VALIDATE_SCRIPT_PATH)
validate_languages = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validate_languages)

# ── Static lookup tables (checked before ever calling Gemini) ──────────────────
# Direction for every language DeutschPath's AI-explanation system already
# supports (frontend/src/lib/languages.ts SUPPORTED_LANGUAGES) — copied
# directly from that file's own `rtl` flags, not independently guessed, so
# there's nothing here that could be wrong unless lib/languages.ts itself is.
# Deliberately scoped to that list rather than the world's languages: these
# are the codes actually likely to be requested as a UI language too, and
# every one is already vetted elsewhere in the app. Keep in sync with
# frontend/src/lib/languages.ts if that file's rtl flags ever change.
AI_EXPLANATION_LANGUAGE_DIRECTIONS = {
    "en": "ltr", "fa": "rtl", "ru": "ltr", "ar": "rtl", "fr": "ltr", "es": "ltr",
    "tr": "ltr", "zh": "ltr", "it": "ltr", "pl": "ltr", "uk": "ltr", "ja": "ltr",
    "ko": "ltr", "pt": "ltr", "nl": "ltr", "sv": "ltr",
}
# RTL languages beyond that list — legitimately, unambiguously RTL, but not
# part of lib/languages.ts, so kept as a separate (deliberately small) table
# rather than folded into the dict above.
EXTRA_KNOWN_RTL_LANGUAGES = {
    "he": "Hebrew", "ur": "Urdu", "ps": "Pashto", "sd": "Sindhi",
    "ckb": "Central Kurdish (Sorani)", "dv": "Divehi", "yi": "Yiddish",
    "ug": "Uyghur", "arc": "Aramaic", "syr": "Syriac",
}
# A handful of common, unambiguous cases; anything else falls through to Gemini.
# fr/es/it/pt/nl/sv all use the simple CLDR {one, other} pattern for the
# small-integer counts this app's UI actually pluralizes (day streaks, word
# counts) — added to cover the rest of lib/languages.ts's 16 AI-explanation
# languages, same reasoning as AI_EXPLANATION_LANGUAGE_DIRECTIONS above.
KNOWN_PLURAL_CATEGORIES = {
    "en": {"one", "other"}, "de": {"one", "other"}, "es": {"one", "other"},
    "fa": {"one", "other"}, "hi": {"one", "other"}, "tr": {"other"},
    "ja": {"other"}, "zh": {"other"}, "ko": {"other"}, "th": {"other"},
    "vi": {"other"}, "id": {"other"},
    "ar": {"zero", "one", "two", "few", "many", "other"},
    "ru": {"one", "few", "many", "other"}, "pl": {"one", "few", "many", "other"},
    "uk": {"one", "few", "many", "other"}, "cs": {"one", "few", "many", "other"},
    "he": {"one", "two", "many", "other"},
    "fr": {"one", "other"}, "it": {"one", "other"}, "pt": {"one", "other"},
    "nl": {"one", "other"}, "sv": {"one", "other"},
}
VALID_CLDR_CATEGORIES = {"zero", "one", "two", "few", "many", "other"}


def log(msg=""):
    print(msg, flush=True)


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


# ── Gemini call helper (mirrors backend/services/ai_service.py's _call/_parse_json) ──
def _gemini_client():
    try:
        from google import genai
    except ImportError:
        sys.exit(
            "The 'google-genai' package isn't installed in this Python environment.\n"
            "Run this script with the backend's venv, e.g.:\n"
            f"  {REPO_ROOT}/backend/venv/bin/python3 {Path(__file__).name} ..."
        )
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / "backend" / ".env")
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("GEMINI_API_KEY is not set in backend/.env — required to generate a catalog.")
    return genai.Client(api_key=key)


def call_gemini(client, prompt: str, max_output_tokens: int = 32768, attempts: int = 5) -> str:
    from google.genai import types
    last_exc = RuntimeError("no attempts made")
    for attempt in range(attempts):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    max_output_tokens=max_output_tokens,
                ),
            )
            return response.text
        except Exception as exc:  # noqa: BLE001 - retry any transient failure (e.g. 503 UNAVAILABLE under load)
            last_exc = exc
            if attempt < attempts - 1:
                wait = min(2 ** attempt, 30)
                log(f"    ({exc.__class__.__name__}: {exc}) — retrying in {wait}s (attempt {attempt + 2}/{attempts})...")
                time.sleep(wait)
    raise last_exc


def parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ── Step 1: direction ──────────────────────────────────────────────────────────
def determine_direction(code: str, name: str, client, forced: str | None, auto_yes: bool) -> str:
    if forced:
        log(f"Direction: {forced} (given via --direction)")
        return forced
    if code in AI_EXPLANATION_LANGUAGE_DIRECTIONS:
        direction = AI_EXPLANATION_LANGUAGE_DIRECTIONS[code]
        log(f"Direction: {direction} ('{code}' matches lib/languages.ts's SUPPORTED_LANGUAGES rtl flag)")
        return direction
    if code in EXTRA_KNOWN_RTL_LANGUAGES:
        log(f"Direction: rtl ('{code}' is in the static known-RTL-languages table)")
        return "rtl"
    log(f"'{code}' isn't in either static direction table — asking Gemini as a fallback...")
    answer = call_gemini(
        client,
        f"Is the {name} language (ISO code '{code}') written right-to-left or "
        "left-to-right in its standard modern orthography? Answer with EXACTLY "
        "one word: RTL or LTR.",
        max_output_tokens=16,
    ).strip().upper()
    direction = "rtl" if "RTL" in answer else "ltr"
    log(f"Gemini says: {answer!r} -> {direction}")
    if not auto_yes:
        reply = input(f"Proceed with direction={direction} for {name} ({code})? [y/N] ").strip().lower()
        if reply != "y":
            sys.exit("Aborted. Re-run with --direction rtl|ltr, or add the code to EXTRA_KNOWN_RTL_LANGUAGES.")
    return direction


# ── Step 2: plural categories ───────────────────────────────────────────────────
def determine_plural_categories(code: str, name: str, client, forced: str | None, auto_yes: bool) -> set[str]:
    if forced:
        cats = {c.strip() for c in forced.split(",")}
        log(f"Plural categories: {sorted(cats)} (given via --plural-categories)")
        return cats
    if code in KNOWN_PLURAL_CATEGORIES:
        cats = KNOWN_PLURAL_CATEGORIES[code]
        log(f"Plural categories: {sorted(cats)} ('{code}' is in the static CLDR table)")
        return cats
    log(f"'{code}' isn't in the static CLDR table — asking Gemini as a fallback...")
    answer = call_gemini(
        client,
        f"What are the CLDR plural categories for the {name} language (ISO code "
        f"'{code}')? The valid categories are exactly: zero, one, two, few, many, "
        "other. 'other' always applies. Answer with ONLY a comma-separated list "
        "of the categories that apply, nothing else, e.g.: one, other",
        max_output_tokens=32,
    ).strip()
    cats = {c.strip().lower() for c in answer.split(",") if c.strip()}
    invalid = cats - VALID_CLDR_CATEGORIES
    if invalid or "other" not in cats:
        sys.exit(f"Gemini's plural-category answer looks wrong ({answer!r}) — pass --plural-categories explicitly.")
    log(f"Gemini says: {answer!r} -> {sorted(cats)}")
    if not auto_yes:
        reply = input(f"Proceed with categories={sorted(cats)} for {name} ({code})? [y/N] ").strip().lower()
        if reply != "y":
            sys.exit("Aborted. Re-run with --plural-categories 'one,other' (etc.), or add the code to KNOWN_PLURAL_CATEGORIES.")
    return cats


# ── Step 3: prompt template + catalog generation ───────────────────────────────
def load_prompt_template() -> str:
    text = PROMPT_DOC_PATH.read_text(encoding="utf-8")
    m = re.search(
        r"<!-- PROMPT_TEMPLATE_START -->\s*```text\n(.*?)\n```\s*<!-- PROMPT_TEMPLATE_END -->",
        text, re.DOTALL,
    )
    if not m:
        sys.exit(f"Could not find the prompt template markers in {PROMPT_DOC_PATH} — has it been edited?")
    return m.group(1)


def direction_note(direction: str, name: str) -> str:
    if direction == "rtl":
        return (
            f"{name} is written right-to-left. The app mirrors the whole layout "
            "automatically based on the catalog's locale — do NOT reverse strings, "
            "add direction marks, or otherwise try to handle this yourself; just "
            "translate normally, left-to-right in your own writing process, and "
            "the app takes care of the rest."
        )
    return f"{name} is left-to-right like English, so do not mirror anything."


def build_prompt(name: str, code: str, direction: str, plural_categories: set[str], en_json_text: str) -> str:
    template = load_prompt_template()
    filled = (
        template
        .replace("{{LANGUAGE_NAME}}", name)
        .replace("{{PLURAL_CATEGORIES}}", ", ".join(sorted(plural_categories)))
        .replace("{{DIRECTION_NOTE}}", direction_note(direction, name))
        .replace(
            "{{TERMINOLOGY_NOTE}}",
            f"Use terms a {name}-speaking German learner would recognize for grammar "
            "cases (Nominative/Accusative/Dative/Genitive), genders (Masculine/"
            "Feminine/Neuter/Plural), and verb tenses/moods. Prefer terminology "
            f"already established in {name}'s own grammar-teaching tradition over "
            "invented coinages.",
        )
        .replace(
            "{{TONE_NOTE}}",
            f"Natural, friendly {name} appropriate for a modern app UI, with a single "
            "consistent politeness/formality register used throughout. Common "
            f"English tech loanwords are fine if that's what a modern {name} app UI "
            "would normally use — don't force awkward purist coinages.",
        )
    )
    return filled.replace(
        "<paste the full contents of frontend/src/messages/en.json here>",
        en_json_text,
    )


def generate_full_catalog(client, prompt: str) -> dict:
    log("Calling Gemini for the full catalog (one request)...")
    text = call_gemini(client, prompt)
    return parse_json_response(text)


def generate_catalog_per_namespace(client, name: str, code: str, direction: str,
                                    plural_categories: set[str], en: dict) -> dict:
    log("Falling back to per-namespace translation (handles truncation)...")
    template = load_prompt_template()
    header = template.split("INPUT CATALOG:")[0]
    header = (
        header
        .replace("{{LANGUAGE_NAME}}", name)
        .replace("{{PLURAL_CATEGORIES}}", ", ".join(sorted(plural_categories)))
        .replace("{{DIRECTION_NOTE}}", direction_note(direction, name))
        .replace("{{TERMINOLOGY_NOTE}}", f"Use terms a {name}-speaking German learner would recognize.")
        .replace("{{TONE_NOTE}}", f"Natural, friendly {name} for a modern app UI.")
    )
    result = {}
    for namespace, content in en.items():
        log(f"  translating namespace '{namespace}'...")
        ns_prompt = (
            f"{header}\n"
            f"This is ONE namespace (\"{namespace}\") of the catalog, not the whole "
            "thing. Apply all the same rules. Output ONLY the JSON value for this "
            "namespace (same structure/keys as input), nothing else — no wrapping "
            "object, no markdown fences.\n\n"
            f"INPUT (namespace \"{namespace}\"):\n{json.dumps(content, ensure_ascii=False, indent=2)}"
        )
        text = call_gemini(client, ns_prompt)
        result[namespace] = parse_json_response(text)
    return result


# ── Step 4: in-memory validation before anything touches disk ─────────────────
def quick_validate(en: dict, new: dict, code: str, plural_categories: set[str]) -> list[str]:
    problems = []
    en_flat = dict(validate_languages.flatten(en))
    new_flat = dict(validate_languages.flatten(new))

    missing = set(en_flat) - set(new_flat)
    extra = set(new_flat) - set(en_flat)
    if missing:
        problems.append(f"missing {len(missing)} keys: {validate_languages.truncated(missing)}")
    if extra:
        problems.append(f"has {len(extra)} unexpected extra keys: {validate_languages.truncated(extra)}")

    shape_bad, placeholder_bad, tag_bad, plural_bad = [], [], [], []
    for key, en_val in en_flat.items():
        target_val = new_flat.get(key)
        if target_val is None:
            continue
        if isinstance(en_val, list):
            if not isinstance(target_val, list) or len(target_val) != len(en_val):
                shape_bad.append(key)
            continue
        if not isinstance(en_val, str) or not isinstance(target_val, str):
            continue
        if sorted(validate_languages.PLACEHOLDER_RE.findall(en_val)) != sorted(validate_languages.PLACEHOLDER_RE.findall(target_val)):
            placeholder_bad.append(key)
        if sorted(validate_languages.TAG_RE.findall(en_val)) != sorted(validate_languages.TAG_RE.findall(target_val)):
            tag_bad.append(key)

    for key, val in new_flat.items():
        if not isinstance(val, str) or ", plural," not in val:
            continue
        for block in validate_languages.PLURAL_BLOCK_RE.findall(val):
            cats = set(validate_languages.CATEGORY_RE.findall(block))
            if "other" not in cats:
                plural_bad.append((key, "missing mandatory 'other'"))
            elif not cats.issubset(plural_categories):
                plural_bad.append((key, f"category outside {sorted(plural_categories)}: {sorted(cats - plural_categories)}"))

    if shape_bad:
        problems.append(f"{len(shape_bad)} array-shape mismatches: {validate_languages.truncated(shape_bad)}")
    if placeholder_bad:
        problems.append(f"{len(placeholder_bad)} placeholder mismatches: {validate_languages.truncated(placeholder_bad)}")
    if tag_bad:
        problems.append(f"{len(tag_bad)} rich-text tag mismatches: {validate_languages.truncated(tag_bad)}")
    if plural_bad:
        problems.append(f"{len(plural_bad)} invalid plural blocks: {validate_languages.truncated(plural_bad, 5)}")
    return problems


# ── Step 5: language-name cross-translation ────────────────────────────────────
def lookup_language_names(client, code: str, name: str, native: str | None, existing_codes: list[str]) -> tuple[dict, dict]:
    log("Asking Gemini for the language-name translations (settings.uiLang.names)...")
    prompt = (
        f"For a language-picker UI, I need language names translated. The new "
        f"language being added is {name} (code '{code}'). The existing UI "
        f"languages are: {', '.join(existing_codes)}.\n\n"
        "Return ONLY this JSON structure, nothing else:\n"
        "{\n"
        f'  "new_language_name_in": {{ {", ".join(f"""\\"{c}\\": "<name of {name} written in language {c}>\"""" for c in existing_codes)} }},\n'
        f'  "existing_language_names_in_new_language": {{ {", ".join(f"""\\"{c}\\": "<name of language {c} written in {name}>\"""" for c in existing_codes)}, "{code}": "<name of {name} written in {name} itself{" — same as " + native if native else ""}>" }}\n'
        "}"
    )
    text = call_gemini(client, prompt, max_output_tokens=2048)
    data = parse_json_response(text)
    return data["new_language_name_in"], data["existing_language_names_in_new_language"]


def merge_language_names(new_language_name_in: dict, existing_names_in_new: dict, code: str, dry_run: bool):
    for existing_code in new_language_name_in:
        path = MESSAGES_DIR / f"{existing_code}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["settings"]["uiLang"]["names"][code] = new_language_name_in[existing_code]
        if dry_run:
            log(f"  [dry-run] would add settings.uiLang.names.{code} = {new_language_name_in[existing_code]!r} to {path.name}")
        else:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            log(f"  updated settings.uiLang.names in {path.name}")
    return existing_names_in_new  # merged into the new catalog itself by the caller


# ── Step 6: config.ts edit, guarded by a shape assertion ───────────────────────
def patch_config_ts(code: str, name: str, native: str, direction: str, dry_run: bool):
    text = CONFIG_TS_PATH.read_text(encoding="utf-8")

    locales_re = re.compile(r'(export const UI_LOCALES = \[)([^\]]*)(\] as const;)')
    rtl_re = re.compile(r'(const RTL_LOCALES: ReadonlySet<string> = new Set\(\[)([^\]]*)(\]\);)')
    labels_re = re.compile(
        r'(export const UI_LOCALE_LABELS: Record<UiLocale, \{ name: string; nativeName: string \}> = \{\n)'
        r'((?:.*\n)*?)'
        r'(\};)'
    )

    m_locales = locales_re.search(text)
    m_rtl = rtl_re.search(text)
    m_labels = labels_re.search(text)
    if not (m_locales and m_rtl and m_labels):
        sys.exit(
            f"{CONFIG_TS_PATH} doesn't match the shape this script knows how to edit "
            "(UI_LOCALES / RTL_LOCALES / UI_LOCALE_LABELS patterns not found as expected). "
            "Aborting with NO changes to this file — add the language here by hand instead: "
            f'add "{code}" to UI_LOCALES, {"add it to RTL_LOCALES, " if direction == "rtl" else ""}'
            f'and add {code}: {{ name: "{name}", nativeName: "{native}" }} to UI_LOCALE_LABELS.'
        )

    existing_locale_codes = re.findall(r'"([a-z-]+)"', m_locales.group(2))
    if code in existing_locale_codes:
        sys.exit(f"'{code}' is already in UI_LOCALES — nothing to do (or remove it first to regenerate).")

    # Verify every existing UI_LOCALE_LABELS line matches the exact shape we expect,
    # so we know we understand the block before touching it.
    label_line_re = re.compile(r'^\s*([a-z-]+): \{ name: "([^"]*)", nativeName: "([^"]*)" \},?\s*$')
    label_lines = [ln for ln in m_labels.group(2).split("\n") if ln.strip()]
    for ln in label_lines:
        if not label_line_re.match(ln):
            sys.exit(
                f"A line inside UI_LOCALE_LABELS doesn't match the expected shape:\n  {ln!r}\n"
                "Aborting with NO changes to this file — the block has drifted from what "
                "this script knows how to parse; add the new entry by hand instead."
            )

    new_locales_line = m_locales.group(1) + m_locales.group(2).rstrip() + f', "{code}"' + m_locales.group(3)
    new_text = text[:m_locales.start()] + new_locales_line + text[m_locales.end():]

    if direction == "rtl":
        # Re-find RTL_LOCALES in new_text (the UI_LOCALES edit above may have shifted offsets).
        m_rtl2 = rtl_re.search(new_text)
        new_rtl_line = m_rtl2.group(1) + m_rtl2.group(2).rstrip() + f', "{code}"' + m_rtl2.group(3)
        new_text = new_text[:m_rtl2.start()] + new_rtl_line + new_text[m_rtl2.end():]

    m_labels2 = labels_re.search(new_text)
    new_label_line = f'  {code}: {{ name: "{name}", nativeName: "{native}" }},\n'
    new_labels_block = m_labels2.group(1) + m_labels2.group(2) + new_label_line + m_labels2.group(3)
    new_text = new_text[:m_labels2.start()] + new_labels_block + new_text[m_labels2.end():]

    if dry_run:
        log(f"  [dry-run] would add \"{code}\" to UI_LOCALES")
        if direction == "rtl":
            log(f"  [dry-run] would add \"{code}\" to RTL_LOCALES")
        log(f"  [dry-run] would add {new_label_line.strip()!r} to UI_LOCALE_LABELS")
    else:
        CONFIG_TS_PATH.write_text(new_text, encoding="utf-8", newline="\n")
        log(f"  updated {rel(CONFIG_TS_PATH)}")


# ── Step 7: register the new plural-category set in validate_languages.py ─────
def patch_validate_script(code: str, plural_categories: set[str], dry_run: bool):
    text = VALIDATE_SCRIPT_PATH.read_text(encoding="utf-8")
    dict_re = re.compile(r'(CLDR_PLURAL_CATEGORIES = \{\n)((?:.*\n)*?)(\})')
    m = dict_re.search(text)
    if not m:
        log(f"  WARNING: could not find CLDR_PLURAL_CATEGORIES in {VALIDATE_SCRIPT_PATH.name} — add it by hand:")
        log(f'    "{code}": {{{", ".join(repr(c) for c in sorted(plural_categories))}}},')
        return
    entry_re = re.compile(r'^\s*"([a-z-]+)":\s*\{[^}]*\},?\s*$')
    lines = [ln for ln in m.group(2).split("\n") if ln.strip()]
    for ln in lines:
        if not entry_re.match(ln):
            log(f"  WARNING: a line in CLDR_PLURAL_CATEGORIES doesn't match the expected shape ({ln!r}) — add the new entry by hand.")
            return
        existing_code = entry_re.match(ln).group(1)
        if existing_code == code:
            log(f"  '{code}' is already in CLDR_PLURAL_CATEGORIES — leaving as-is.")
            return

    cats_literal = "{" + ", ".join(f'"{c}"' for c in sorted(plural_categories)) + "}"
    new_line = f'    "{code}": {cats_literal},\n'
    new_dict_block = m.group(1) + m.group(2) + new_line + m.group(3)
    new_text = text[:m.start()] + new_dict_block + text[m.end():]

    if dry_run:
        log(f"  [dry-run] would add {new_line.strip()!r} to CLDR_PLURAL_CATEGORIES")
    else:
        VALIDATE_SCRIPT_PATH.write_text(new_text, encoding="utf-8", newline="\n")
        log(f"  updated {rel(VALIDATE_SCRIPT_PATH)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--code", required=True, help='ISO-ish language code, e.g. "tr"')
    ap.add_argument("--name", required=True, help='English name of the language, e.g. "Turkish"')
    ap.add_argument("--native", help='Native name, e.g. "Türkçe" (looked up via Gemini if omitted)')
    ap.add_argument("--direction", choices=["rtl", "ltr"], help="Skip the RTL/LTR lookup entirely")
    ap.add_argument("--plural-categories", help='Comma-separated CLDR categories, e.g. "one,other" — skips the lookup')
    ap.add_argument("--dry-run", action="store_true", help="Perform every step but never write to disk")
    ap.add_argument("--yes", action="store_true", help="Don't ask for confirmation on Gemini-sourced lookups")
    args = ap.parse_args()

    code = args.code.strip().lower()
    if not re.match(r"^[a-z]{2,3}(-[a-z]{2,4})?$", code):
        sys.exit(f"'{code}' doesn't look like a valid language code (expected e.g. 'tr', 'zh-hant').")

    existing_codes = [p.stem for p in sorted(MESSAGES_DIR.glob("*.json"))]
    if code in existing_codes:
        sys.exit(f"frontend/src/messages/{code}.json already exists — remove it first to regenerate.")

    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    client = _gemini_client()

    log(f"=== Adding '{args.name}' ({code}) {'[DRY RUN]' if args.dry_run else ''} ===\n")

    direction = determine_direction(code, args.name, client, args.direction, args.yes)
    plural_categories = determine_plural_categories(code, args.name, client, args.plural_categories, args.yes)

    log("\nGenerating the catalog (this may take a minute)...")
    prompt = build_prompt(args.name, code, direction, plural_categories, EN_PATH.read_text(encoding="utf-8"))
    try:
        new_catalog = generate_full_catalog(client, prompt)
        if set(new_catalog) != set(en):
            raise ValueError(f"top-level namespaces don't match: got {sorted(set(new_catalog) ^ set(en))} difference")
    except Exception as exc:
        log(f"Full-catalog generation didn't come back clean ({exc}) — retrying per namespace.")
        new_catalog = generate_catalog_per_namespace(client, args.name, code, direction, plural_categories, en)

    log("\nValidating the generated catalog before writing anything...")
    problems = quick_validate(en, new_catalog, code, plural_categories)
    if problems:
        log("VALIDATION FAILED — nothing has been written or changed:")
        for p in problems:
            log(f"  - {p}")
        if not args.dry_run:
            rejected_path = MESSAGES_DIR / f"{code}.rejected.json"
            rejected_path.write_text(json.dumps(new_catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            log(f"\nSaved the generated (invalid) catalog to {rejected_path} for inspection/manual fixing.")
        sys.exit(1)
    log("In-memory validation passed (key parity, placeholders, plurals, rich-text tags).")

    native = args.native
    new_language_name_in, existing_names_in_new = lookup_language_names(client, code, args.name, native, existing_codes)
    if not native:
        native = existing_names_in_new.get(code, args.name)
        log(f"Native name (from Gemini): {native}")

    log(f"\n{'[dry-run] Would write' if args.dry_run else 'Writing'} frontend/src/messages/{code}.json...")
    if not args.dry_run:
        out_path = MESSAGES_DIR / f"{code}.json"
        new_catalog_with_names = dict(new_catalog)
        new_catalog_with_names.setdefault("settings", {}).setdefault("uiLang", {})["names"] = existing_names_in_new
        out_path.write_text(json.dumps(new_catalog_with_names, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        log(f"  wrote {rel(out_path)}")
    else:
        log(f"  [dry-run] settings.uiLang.names in the new catalog would be: {existing_names_in_new}")

    log("\nMerging language names into existing catalogs...")
    merge_language_names(new_language_name_in, existing_names_in_new, code, args.dry_run)

    log(f"\nPatching {rel(CONFIG_TS_PATH)}...")
    patch_config_ts(code, args.name, native, direction, args.dry_run)

    log(f"\nPatching {rel(VALIDATE_SCRIPT_PATH)}...")
    patch_validate_script(code, plural_categories, args.dry_run)

    if args.dry_run:
        log("\n=== DRY RUN COMPLETE — nothing was written. Re-run without --dry-run to apply. ===")
        return

    log("\nRunning validate_languages.py...")
    result = subprocess.run([sys.executable, str(VALIDATE_SCRIPT_PATH)], capture_output=True, text=True)
    log(result.stdout)
    log(result.stderr)
    if result.returncode != 0:
        log("validate_languages.py FAILED — review the output above before shipping this language.")
        sys.exit(1)

    log("Running npx tsc --noEmit (frontend)...")
    tsc = subprocess.run([NPX, "tsc", "--noEmit"], cwd=str(REPO_ROOT / "frontend"), capture_output=True, text=True)
    if tsc.returncode != 0:
        log(tsc.stdout)
        log(tsc.stderr)
        log("tsc FAILED — the config.ts edit may have introduced a type error. Review before shipping.")
        sys.exit(1)
    log("tsc passed.")

    log(
        f"\n=== Done. '{args.name}' ({code}) is wired in. ===\n"
        "Remaining manual steps (see multilingual-support/adding-a-language.md §6):\n"
        "  - npm run build, then switch to it in Settings -> App Language and click through a few pages.\n"
        "  - Have a native speaker skim the result, specifically checking short grammar-term labels in isolation.\n"
        "  - Optional: add a script-specific font to globals.css if the default sans-serif fallback looks off."
    )


if __name__ == "__main__":
    main()
