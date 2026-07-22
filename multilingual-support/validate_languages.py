"""
Multilingual-catalog regression tests for DeutschPath.

Run:  python3 multilingual-support/validate_languages.py

These tests auto-discover every frontend/src/messages/<code>.json file
except en.json (the source of truth) and validate each one against it.
Dropping a new frontend/src/messages/<code>.json in (e.g. tr.json for
Turkish) gets it covered by every check below on the next run — nothing
else to wire up. See adding-a-language.md for the language-addition
workflow this is meant to gate before a new catalog ships (add_language.py
runs this automatically as its last step).

What's checked, and why (each bullet is a real bug this project hit once):
  - key parity            -> a catalog missing/adding keys vs en.json
                              (t() throws on a missing key at runtime)
  - value shape parity    -> a string became a list or vice versa, or an
                              array (e.g. a tips_* list) lost/gained items
  - placeholder integrity -> {count}/${tts}-style tokens dropped, duplicated,
                              or mistyped during translation
  - rich-text tags        -> <strong>/<em>/<a>/<code>/<mono>/<rule> tags
                              dropped or duplicated during translation
  - ICU plural validity   -> a plural block missing the mandatory "other"
                              category, or using a category CLDR doesn't
                              define for that language
  - sacred German strings -> a handful of keys are deliberately German in
                              every locale (immersion design); this catches
                              a translator "fixing" them by mistake
"""
import glob
import json
import os
import re
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESSAGES_DIR = os.path.join(REPO_ROOT, "frontend/src/messages")
EN_PATH = os.path.join(MESSAGES_DIR, "en.json")

# CLDR plural categories per locale. A locale not listed here still gets the
# generic ICU checks (valid syntax, "other" present) but not the "only these
# categories" check — add the new language's set here when it ships.
CLDR_PLURAL_CATEGORIES = {
    "fa": {"one", "other"},
    "hi": {"one", "other"},
    "ar": {"zero", "one", "two", "few", "many", "other"},
    "tr": {"other"},
    "ur": {"one", "other"},
}

# A representative sample of keys documented in README.md #7 as
# deliberately German in every locale (immersion design). Not exhaustive —
# add to this list if more such keys are introduced.
SACRED_GERMAN_KEYS = [
    "writing.topicsHeader",   # "Themen"
    "writing.taskLabel",      # "Aufgabenstellung:"
    "diffView.yourText",      # "Ihr Text"
    "diffView.errorMark",     # "Fehler"
    "diffView.improvedVersion",  # "Verbesserte Version"
]

PLACEHOLDER_RE = re.compile(r"\$?\{[a-zA-Z_][a-zA-Z0-9_]*\}")
TAG_RE = re.compile(r"</?(strong|em|b|a|code|mono|rule)\b[^>]*>")
PLURAL_BLOCK_RE = re.compile(r"\{[a-zA-Z0-9_]+,\s*plural,\s*(.*?)\}\}", re.DOTALL)
CATEGORY_RE = re.compile(r"\b(zero|one|two|few|many|other)\b(?=\s*\{)")


def flatten(d, prefix=""):
    """Yield (dotted.key.path, value) for every leaf (str/list) in a nested dict."""
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            yield from flatten(v, path)
        else:
            yield path, v


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def locale_files():
    """Every frontend/src/messages/<code>.json file except en.json."""
    all_files = sorted(glob.glob(os.path.join(MESSAGES_DIR, "*.json")))
    return [p for p in all_files if os.path.basename(p) != "en.json"]


def truncated(items, n=8):
    items = sorted(items) if not isinstance(items, list) else items
    more = f" (+{len(items) - n} more)" if len(items) > n else ""
    return f"{items[:n]}{more}"


class CatalogTests(unittest.TestCase):
    """One test method per check, run over every non-English catalog found
    in frontend/src/messages/ via subTest — a failure in one locale doesn't
    hide failures in another."""

    @classmethod
    def setUpClass(cls):
        cls.en = dict(flatten(load(EN_PATH)))
        files = locale_files()
        cls.locales = {os.path.basename(p)[:-5]: dict(flatten(load(p))) for p in files}
        assert cls.locales, (
            f"No locale catalogs found in {MESSAGES_DIR} besides en.json — "
            "did the messages directory move?"
        )

    def test_key_parity(self):
        en_keys = set(self.en)
        for code, cat in self.locales.items():
            with self.subTest(locale=code):
                missing = en_keys - set(cat)
                extra = set(cat) - en_keys
                self.assertFalse(missing, f"{code}.json is missing keys: {truncated(missing)}")
                self.assertFalse(extra, f"{code}.json has extra keys not in en.json: {truncated(extra)}")

    def test_value_shape_matches(self):
        """A string in English must stay a string; a list must stay a same-length list."""
        for code, cat in self.locales.items():
            with self.subTest(locale=code):
                bad = []
                for key, en_val in self.en.items():
                    if key not in cat:
                        continue  # already reported by test_key_parity
                    target_val = cat[key]
                    if isinstance(en_val, list):
                        if not isinstance(target_val, list):
                            bad.append((key, "expected array, got " + type(target_val).__name__))
                        elif len(target_val) != len(en_val):
                            bad.append((key, f"array length {len(target_val)} != en's {len(en_val)}"))
                    elif not isinstance(target_val, str):
                        bad.append((key, "expected string, got " + type(target_val).__name__))
                self.assertFalse(bad, f"{code}.json shape mismatches: {truncated(bad, 5)}")

    def test_placeholders_preserved(self):
        """Every {placeholder}/${placeholder} in English must appear, verbatim and
        the same number of times, in the translation."""
        for code, cat in self.locales.items():
            with self.subTest(locale=code):
                bad = []
                for key, en_val in self.en.items():
                    target_val = cat.get(key)
                    if not isinstance(en_val, str) or not isinstance(target_val, str):
                        continue
                    en_tokens = sorted(PLACEHOLDER_RE.findall(en_val))
                    target_tokens = sorted(PLACEHOLDER_RE.findall(target_val))
                    if en_tokens != target_tokens:
                        bad.append((key, en_tokens, target_tokens))
                self.assertFalse(bad, f"{code}.json placeholder mismatches (key, expected, found): {truncated(bad, 5)}")

    def test_rich_text_tags_preserved(self):
        """<strong>/<em>/<b>/<a>/<code>/<mono>/<rule> tags must appear the same
        number of times as in English."""
        for code, cat in self.locales.items():
            with self.subTest(locale=code):
                bad = []
                for key, en_val in self.en.items():
                    target_val = cat.get(key)
                    if not isinstance(en_val, str) or not isinstance(target_val, str):
                        continue
                    en_tags = sorted(TAG_RE.findall(en_val))
                    target_tags = sorted(TAG_RE.findall(target_val))
                    if en_tags != target_tags:
                        bad.append((key, en_tags, target_tags))
                self.assertFalse(bad, f"{code}.json rich-text tag mismatches (key, expected, found): {truncated(bad, 5)}")

    def test_plural_blocks_valid(self):
        """Every ICU plural block must include the mandatory 'other' category. For
        locales in CLDR_PLURAL_CATEGORIES, it must not use a category CLDR doesn't
        define for that language."""
        for code, cat in self.locales.items():
            allowed = CLDR_PLURAL_CATEGORIES.get(code)
            with self.subTest(locale=code):
                bad = []
                for key, val in cat.items():
                    if not isinstance(val, str) or ", plural," not in val:
                        continue
                    for block in PLURAL_BLOCK_RE.findall(val):
                        cats = set(CATEGORY_RE.findall(block))
                        if "other" not in cats:
                            bad.append((key, "missing mandatory 'other'", sorted(cats)))
                        elif allowed and not cats.issubset(allowed):
                            bad.append((key, f"category outside {code}'s CLDR set {sorted(allowed)}", sorted(cats - allowed)))
                self.assertFalse(bad, f"{code}.json invalid plural blocks: {truncated(bad, 5)}")

    def test_german_sacred_strings_unchanged(self):
        """A handful of keys are deliberately German in every locale (immersion
        design, see README.md #7). A translator (human or LLM) "fixing"
        one of these is the single most likely accidental-translation mistake."""
        present = [k for k in SACRED_GERMAN_KEYS if k in self.en]
        self.assertTrue(present, "None of SACRED_GERMAN_KEYS exist in en.json anymore — update the list in this file")
        for key in present:
            en_val = self.en[key]
            for code, cat in self.locales.items():
                with self.subTest(locale=code, key=key):
                    if key in cat:
                        self.assertEqual(
                            cat[key], en_val,
                            f"{code}.json[{key}] must stay German ('{en_val}') but was translated to '{cat[key]}'",
                        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
