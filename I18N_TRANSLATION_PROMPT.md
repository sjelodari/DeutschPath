# Example Prompt: Generating a New Language Catalog with an LLM

Use this prompt to generate a new `frontend/src/messages/<code>.json` catalog from
`en.json` using Gemini (or any capable LLM). The example below targets **Hindi** —
to use it for another language, replace "Hindi" throughout, and adjust rule 5
(plural categories), rule 9 (text direction), and rule 10 (grammar terminology)
for the target language. See the checklist at the bottom for wiring the file in.

> Tip: paste into Google AI Studio (large context), not a small chat window.
> If the output truncates, re-run per namespace ("translate only the `cases`
> object") and merge — the parity script below catches anything missing.

---

## The prompt

```text
You are localizing a German-learning web app called DeutschPath from English to Hindi.
Below is the app's English message catalog (JSON). Produce the complete Hindi catalog.

OUTPUT RULES
1. Output ONLY valid JSON — no markdown fences, no commentary, no trailing text.
2. Keep the EXACT same structure: every key, every nesting level, every array, in the
   same order. Translate only the string VALUES, never the keys.
3. The output must contain exactly the same number of keys as the input. Do not drop,
   add, or merge any key.

TRANSLATION RULES
4. Placeholders like {count}, {score}, {total}, {pct}, {msg}, {page}, {lang}, {text},
   {email}, {file}, {min}, {max}, {need}, {n}, {current}, {days}, {saved}, {due},
   {persona}, {exam}, {level}, ${total}, ${text}, ${tts} must be preserved EXACTLY,
   character for character. Reposition them in the sentence as Hindi grammar requires.
5. ICU plural messages like "{count, plural, one {# word} other {# words}}" must keep
   the ICU syntax. Hindi uses the categories "one" and "other". Keep the # symbol.
6. Rich-text tags <strong>…</strong>, <em>…</em>, <b>…</b>, <a>…</a>, <code>…</code>,
   <mono>…</mono>, <rule></rule> must be preserved. Translate the text inside and
   around them, but never remove, rename, or reorder the tags. Keep <rule></rule> and
   the contents of <code>…</code> exactly as they are.
7. GERMAN CONTENT IS SACRED — this is a German-learning app:
   a. If a value is entirely German (e.g. "Themen", "Aufgabenstellung:", "Ergebnis",
      "Stärken", "Analysiere…", "Ihr Text", "Fehler", "Verbesserte Version",
      "Schreiben Sie Ihren Text hier auf Deutsch...",
      "Schreib auf Deutsch oder frag auf Englisch…", "{min}–{max} Wörter",
      "{count} Min", "Noch {count} Wörter bis zum Minimum", "Struktur: {score}/10",
      "Keine Fehler gefunden — ausgezeichnet!"), copy it UNCHANGED into the output.
   b. If a value mixes a German example with an English gloss, e.g.
      "Der Mann schläft. — The man sleeps.", keep the German sentence exactly and
      translate only the gloss: "Der Mann schläft. — आदमी सोता है।"
   c. German grammar words used as data (der, die, das, den, dem, des, ein, kein,
      mein, dessen, denen, wohin?, wo?, mnemonics like DOGFU / ABMNSSVZ, endings like
      -e / -en / -er) always stay unchanged; translate the explanatory text around them.
8. Do NOT translate product/technical names: DeutschPath, Gemini, Google AI Studio,
   GitHub, TTS, API, PDF, OCR, JPG, PNG, WEBP, RPM, Enter, SRS, A1–C2 level codes,
   Goethe/TestDaF/TELC exam names, key prefixes AQ. and AIza.
9. Keep all emoji and symbols (🎉, ✓, ✗, ⚡, ←, →, ·, —) where they appear. Arrows
   that indicate direction of a link/action (e.g. "Get a free key →") may stay as-is;
   Hindi is left-to-right like English, so do not mirror anything.
10. Grammar terminology: use terms a Hindi-speaking German learner would recognize.
    Prefer transliterated case names with the German term available from context:
    Nominative = "कर्ता (Nominativ)", Accusative = "कर्म कारक (Akkusativ)",
    Dative = "संप्रदान कारक (Dativ)", Genitive = "संबंध कारक (Genitiv)".
    Masculine/Feminine/Neuter/Plural = पुल्लिंग / स्त्रीलिंग / नपुंसक / बहुवचन.
    Note "कारक" ("case-marker" suffix): Hindi's short case names (कर्म, संप्रदान,
    संबंध) double as ordinary words ("action/deed", "giving", "relation") — append
    कारक so the label unambiguously reads as a grammar case, not the everyday word.
    कर्ता needs no suffix; it already unambiguously means "subject" on its own.
    Every language has its own version of this trap: check that a short technical
    term doesn't collide with a common, unrelated everyday word before shipping it
    bare — if it does, add whatever disambiguating suffix/marker that language's own
    grammar tradition uses (Hindi: कारक; Sanskrit-derived terms in other Indic
    languages likely need the same kind of marker).
11. Tone: natural, friendly Hindi as used in modern app UIs (आप form). Everyday
    English loanwords that are normal in Hindi tech UIs (डाउनलोड, सेटिंग्स, ईमेल)
    are fine — do not force awkward pure-Hindi coinages.
12. CONSISTENCY WITH EXISTING CONTENT — do this BEFORE translating, not after:
    a. If the target language's catalog already exists (you're re-running the
       prompt to add new keys, not creating the file from scratch), grep it for
       every term on this checklist that will reappear in the new keys, and
       reuse the EXACT rendering already established for each one. Do not let
       the model reinvent a second, competing translation of a term that's
       already in the file — this app had exactly that bug: the `cases`
       namespace called Accusative "آکوزاتیو" (a transliterated loanword) while
       a later batch of `grammar` keys called it "حالت مفعولی" (a different,
       invented Persian phrase) — same case, two labels.
       Checklist (grep the existing catalog for each before translating):
         - Case names: Nominative, Accusative, Dative, Genitive
         - Genders: Masculine, Feminine, Neuter, Plural
         - Tense/mood: Präsens, Perfekt, Präteritum, Plusquamperfekt, Futur I,
           Futur II, Konjunktiv I, Konjunktiv II, Passiv, Imperativ
         - Structures: modal verb, subordinate clause (Nebensätze), relative
           clause (Relativsätze), participle
       Also watch for a subtler variant: two DIFFERENT concepts colliding onto
       the same target-language word (e.g. an audit of this app's Arabic
       catalog found "modal" (modal verb) and "subjunctive" (Konjunktiv) both
       rendered as "الشرطية" in different keys — not a contradiction like the
       Persian bug since each concept was individually consistent, but worth a
       second modifier/qualifier if the target language has one available).
    b. Also grep `backend/seed_data.py` for a same-language explanation field
       (e.g. `persian_explanation`) — it's older than any frontend catalog and
       reflects the developer's own established phrasing for German technical
       terms (e.g. it keeps "Konjunktiv I", "Präteritum", "Futur I" in Latin
       script rather than transliterating them). Match that precedent instead
       of inventing a new transliteration when one doesn't already exist in the
       frontend catalogs.
    c. After the model responds, spot-check its output against both sources
       above for the recurring terms — this is the single highest-value review
       step, more likely to catch a real error than a general read-through.
    d. Separately from (a) — which catches the SAME term rendered two
       different ways — check whether any short grammar term, even if used
       perfectly consistently, is itself a homograph of a common unrelated
       word in the target language. This is a different failure mode: the
       term can be 100% internally consistent and still confusing to a
       reader. Precedent: Hindi "कर्म" (accusative) also means "action/deed" in
       everyday use, so the catalog appends the case-marker suffix throughout
       — "कर्म कारक" — while "कर्ता" (nominative/subject) needed no such fix
       since it's unambiguous on its own. If the target language has a
       standard grammatical qualifier/suffix for this (as Hindi's कारक is),
       use it; otherwise keep the German term in parentheses as the
       disambiguator.
13. DON'T DROP THE GLOSS in German-example-plus-explanation strings. Some values
    pair a German example with a short parenthetical explanation of WHY it's
    formed that way, not just a translated gloss of what it means — e.g.
    "des Mannes, des Kindes — but: des Autos (already ends in -s-sound, add
    -s)". Rule 7b covers translating a gloss that restates the German meaning;
    this is the separate case of a gloss that explains a grammar rule, and it
    is easy for a model (or a rushed human reviewer) to quietly drop the whole
    parenthetical since the German part still looks complete without it. This
    exact omission happened independently in BOTH the Persian and Arabic
    catalogs for this app (same key, `cases.tips_genitive[1]`) — a strong sign
    it's a systematic risk, not a one-off. After translating, diff each
    German-plus-explanation value's PARENTHETICAL/trailing-clause count against
    the English source specifically (not just spot-checking that German text
    survived) to make sure no explanatory clause silently disappeared.

INPUT CATALOG:
<paste the full contents of frontend/src/messages/en.json here>
```

---

## Adapting the prompt for other languages

| Rule | What to change |
|---|---|
| 5 (plurals) | Use the target language's CLDR plural categories. Examples: Hindi/Persian/Turkish → `one`/`other`; Arabic → `one`/`two`/`few`/`other`; Russian → `one`/`few`/`many`; Japanese/Chinese → `other` only. |
| 9 (direction) | For RTL languages (Hebrew, Urdu, …) note that the app mirrors automatically — the model should still not reverse strings, but you must add the locale code to the RTL set in `src/i18n/config.ts` (see below). |
| 10 (terminology) | Give the model the case/gender terms your target audience actually uses for German grammar. |
| 11 (tone) | Specify the politeness register (e.g. Sie/vous/آپ equivalents). |

## Wiring the new catalog in (after Gemini answers)

1. Save the output as `frontend/src/messages/<code>.json` (e.g. `hi.json`).
2. `frontend/src/i18n/config.ts`: add the code to `UI_LOCALES` and a native-name
   entry to `UI_LOCALE_LABELS` (e.g. `hi: "हिन्दी"`). If the language is RTL, also
   add the code to the RTL set inside `dirFor`.
3. Add the language's name under `settings.uiLang.names` in **every** catalog
   (en, fa, ar, and the new one).
4. Fonts (optional): `globals.css` ships Inter (Latin) + Vazirmatn (Arabic
   script); anything else falls back to an OS system font via `sans-serif`, so
   the new language renders fine without changes. For consistent typography
   across platforms, add a script-specific font to the body stack, e.g.
   `'Noto Sans Devanagari'` for Hindi.
5. Run the automated regression suite — it auto-discovers every catalog in
   `frontend/src/messages/` (the new one included, nothing to configure) and
   checks key parity, placeholder integrity, ICU plural validity, rich-text
   tag preservation, and that the sacred-German strings weren't translated:

```bash
python3 validate_i18n.py
```

   All 6 tests must print `ok`. If the new language isn't in that script's
   `CLDR_PLURAL_CATEGORIES` dict yet, add its CLDR plural category set there
   for the strongest plural check; without it the test still runs but only
   checks generic ICU validity.

6. `npm run build`, then switch to the new language in Settings → App Language and
   click through a few pages. Have a native speaker skim the result — LLM output is
   a strong first draft, not a final translation. Ask them specifically whether any
   short grammar-term label reads as an unrelated everyday word out of context (the
   कारक trap from rule 10) — that's easy to miss on a normal read-through because
   the surrounding sentence still makes sense.
