# Adding a Language

Two ways to add a new UI language to DeutschPath. Both produce the same
result: a validated `frontend/src/messages/<code>.json` catalog, wired into
`frontend/src/i18n/config.ts` and every other catalog's language-name list.

## Fast path: `add_language.py`

```bash
python3 multilingual-support/add_language.py --code tr --name Turkish
```

This calls Gemini to generate the catalog (using the exact prompt template
below), determines RTL/LTR automatically, edits `config.ts`, merges the new
language's name into every catalog's `settings.uiLang.names`, and runs
`validate_languages.py` before reporting success. See its own `--help` for
all options (`--native`, `--direction rtl|ltr` to skip the direction lookup,
`--dry-run` to preview every change without writing anything). Requires
`GEMINI_API_KEY` in `backend/.env` (the same key the app already uses).

**This is a strong first draft, not a finished translation.** Always do
step 6 of the manual checklist below (build it, click through it, get a
native speaker to skim it) before shipping — the script cannot judge
whether the output actually reads naturally.

## Manual path: paste the prompt yourself

Use this if you want to review/tweak the prompt before sending it, or use a
different LLM interactively (e.g. paste into Google AI Studio for its larger
context window and easier truncation recovery). `add_language.py` sends
Gemini the exact same template — it reads it from this file at the markers
below, so editing the template here changes what the script sends too.

> Tip: if the output truncates, re-run per namespace ("translate only the
> `cases` object") and merge — `validate_languages.py` catches anything missing.

<!-- PROMPT_TEMPLATE_START -->
```text
You are localizing a German-learning web app called DeutschPath from English to {{LANGUAGE_NAME}}.
Below is the app's English message catalog (JSON). Produce the complete {{LANGUAGE_NAME}} catalog.

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
   character for character. Reposition them in the sentence as {{LANGUAGE_NAME}} grammar requires.
5. ICU plural messages like "{count, plural, one {# word} other {# words}}" must keep
   the ICU syntax. {{LANGUAGE_NAME}} uses the CLDR plural categories: {{PLURAL_CATEGORIES}}.
   Keep the # symbol. "other" is mandatory and must always be present.
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
      translate only the gloss.
   c. German grammar words used as data (der, die, das, den, dem, des, ein, kein,
      mein, dessen, denen, wohin?, wo?, mnemonics like DOGFU / ABMNSSVZ, endings like
      -e / -en / -er) always stay unchanged; translate the explanatory text around them.
8. Do NOT translate product/technical names: DeutschPath, Gemini, Google AI Studio,
   GitHub, TTS, API, PDF, OCR, JPG, PNG, WEBP, RPM, Enter, SRS, A1–C2 level codes,
   Goethe/TestDaF/TELC exam names, key prefixes AQ. and AIza.
9. Keep all emoji and symbols (🎉, ✓, ✗, ⚡, ←, →, ·, —) where they appear. Arrows
   that indicate direction of a link/action (e.g. "Get a free key →") may stay as-is.
   {{DIRECTION_NOTE}}
10. Grammar terminology: {{TERMINOLOGY_NOTE}}
    Case/gender/tense/mood CATEGORY NAMES (Nominative, Accusative, Dative,
    Genitive, Masculine, Feminine, Neuter, Plural, Präsens, Perfekt, Konjunktiv,
    Passiv, etc.) are NOT exempt "technical terms" the way rule 8's product
    names are — they must be actually translated into {{LANGUAGE_NAME}} (a
    real {{LANGUAGE_NAME}} word, or an established transliteration into
    {{LANGUAGE_NAME}}'s own script/spelling conventions), never simply copied
    unchanged from the English/German source. The German technical term may
    additionally appear in parentheses for cross-reference (as in the worked
    examples below), but it must never be the ONLY thing shown — a bare
    "Accusative" or "Accusative Case" with no {{LANGUAGE_NAME}} at all is a
    failure to translate, not a legitimate stylistic choice, no matter how
    technical the term feels.
    Every language also has its own version of a different trap: a short
    technical term that collides with a common, unrelated everyday word — check
    for this before shipping a term bare, and if it applies, add whatever
    disambiguating suffix/marker that language's own grammar tradition uses for
    exactly this purpose (e.g. Hindi appends कारक to कर्म/संप्रदान/संबंध for its
    case names, because those words also mean "action/deed", "giving",
    "relation" in everyday use — but leaves कर्ता (nominative) bare since it's
    unambiguous on its own).
11. Tone: {{TONE_NOTE}}
12. CONSISTENCY — within your own response, and with any pre-existing catalog:
    0. SELF-CONSISTENCY APPLIES EVEN WHEN YOU ARE CREATING THIS CATALOG FOR THE
       FIRST TIME, in a single response, with no pre-existing file to check
       against. Every term on the checklist below must be rendered IDENTICALLY
       every time it recurs anywhere in your own output — the `cases` namespace
       and the `grammar` namespace frequently reference the exact same grammar
       concept (e.g. the Accusative case) under different keys; use the exact
       same rendering in both, not two different translations, and not
       "translated in one place, left in English in the other" (a real bug
       this app hit: one response rendered `cases.case_Accusative` as
       "Accusative (<gloss>)" but `grammar.ruleName_accusative_case` as the
       bare English "Accusative Case" with no translation at all — internally
       inconsistent AND partially untranslated, in a single one-shot response
       with no prior file to have drifted from). Before finalizing your
       output, mentally re-scan it for each checklist term below and confirm
       every occurrence matches, in every namespace, not just the `cases` one.
    a. If the target language's catalog ALSO already exists (you're re-running
       the prompt to add new keys later, not creating the file from scratch),
       ALSO grep it for every term on this checklist and reuse the EXACT
       rendering already established there — don't invent a second, competing
       translation of a term that's already in the file. This app hit that
       variant too: the `cases` namespace called Accusative "آکوزاتیو" (a
       transliterated loanword) while a later batch of `grammar` keys, added
       in a separate session, called it "حالت مفعولی" (a different, invented
       Persian phrase) — same case, two labels, across two files/sessions
       rather than within one response.
       Checklist (applies to 0 and a alike):
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
    c. After responding, spot-check the output against 0's self-consistency
       requirement and both (a)/(b)'s external sources for the recurring
       terms — this is the single highest-value review step, more likely to
       catch a real error than a general read-through.
    d. Separately from (a) — which catches the SAME term rendered two
       different ways — check whether any short grammar term, even if used
       perfectly consistently, is itself a homograph of a common unrelated
       word in the target language. This is a different failure mode: the
       term can be 100% internally consistent and still confusing to a
       reader. If the target language has a standard grammatical
       qualifier/suffix for this, use it; otherwise keep the German term in
       parentheses as the disambiguator.
13. DON'T DROP THE GLOSS in German-example-plus-explanation strings. Some values
    pair a German example with a short parenthetical explanation of WHY it's
    formed that way, not just a translated gloss of what it means — e.g.
    "des Mannes, des Kindes — but: des Autos (already ends in -s-sound, add
    -s)". Rule 7b covers translating a gloss that restates the German meaning;
    this is the separate case of a gloss that explains a grammar rule, and it
    is easy to quietly drop the whole parenthetical since the German part
    still looks complete without it. This exact omission happened
    independently in BOTH the Persian and Arabic catalogs for this app (same
    key, `cases.tips_genitive[1]`) — a strong sign it's a systematic risk, not
    a one-off. After translating, diff each German-plus-explanation value's
    parenthetical/trailing-clause count against the English source
    specifically (not just spot-checking that German text survived) to make
    sure no explanatory clause silently disappeared.

INPUT CATALOG:
<paste the full contents of frontend/src/messages/en.json here>
```
<!-- PROMPT_TEMPLATE_END -->

### Worked example: the placeholders filled in for Hindi

| Placeholder | Value used for Hindi |
|---|---|
| `{{LANGUAGE_NAME}}` | `Hindi` |
| `{{PLURAL_CATEGORIES}}` | `one, other` |
| `{{DIRECTION_NOTE}}` | `Hindi is left-to-right like English, so do not mirror anything.` |
| `{{TERMINOLOGY_NOTE}}` | `Use terms a Hindi-speaking German learner would recognize. Prefer transliterated case names with the German term available from context: Nominative = "कर्ता (Nominativ)", Accusative = "कर्म कारक (Akkusativ)", Dative = "संप्रदान कारक (Dativ)", Genitive = "संबंध कारक (Genitiv)". Masculine/Feminine/Neuter/Plural = पुल्लिंग / स्त्रीलिंग / नपुंसक / बहुवचन.` |
| `{{TONE_NOTE}}` | `Natural, friendly Hindi as used in modern app UIs (आप form). Everyday English loanwords that are normal in Hindi tech UIs (डाउनलोड, सेटिंग्स, ईमेल) are fine — do not force awkward pure-Hindi coinages.` |

### Adapting the placeholders for other languages

| Placeholder | What to put there |
|---|---|
| `{{PLURAL_CATEGORIES}}` | The target language's CLDR plural categories. Examples: Hindi/Persian/Turkish → `one, other`; Arabic → `zero, one, two, few, many, other`; Russian → `one, few, many, other`; Japanese/Chinese → `other` only. `add_language.py` looks these up from a small built-in table (falling back to asking Gemini) — see its `CLDR_PLURAL_HINTS`. |
| `{{DIRECTION_NOTE}}` | For RTL languages (Arabic, Hebrew, Persian, Urdu, …): note that the app mirrors the whole layout automatically — the model should still not reverse strings itself. For LTR languages, the one-line reassurance shown in the Hindi example is enough. |
| `{{TERMINOLOGY_NOTE}}` | The case/gender/tense terms your target audience actually uses for German grammar, plus which of them might be ambiguous bare (see rule 10's general guidance). This is the one placeholder worth hand-writing with real domain knowledge if you have a native speaker to ask — the script's default is a generic instruction to "use natural, internally-consistent terminology," which works but isn't as good as a curated example. |
| `{{TONE_NOTE}}` | The politeness register (e.g. Sie/vous/آپ/आप equivalents) and whether English tech loanwords are normal in that language's app UIs. |

## Wiring the new catalog in

`add_language.py` does steps 1, 2, 3, and 5 automatically. Steps 4 and 6 are
judgment calls only a human (ideally a native speaker) should make.

1. Save the output as `frontend/src/messages/<code>.json` (e.g. `tr.json`).
2. `frontend/src/i18n/config.ts`: add the code to `UI_LOCALES`, a
   `{ name, nativeName }` entry to `UI_LOCALE_LABELS`, and — if RTL — the code
   to `RTL_LOCALES`.
3. Add the language's name under `settings.uiLang.names` in **every** catalog
   (existing ones get the new language's name added; the new catalog gets
   every existing language's name, including its own).
4. Fonts (optional, human judgment): `globals.css` ships Inter (Latin) +
   Vazirmatn (Arabic script); anything else falls back to an OS system font
   via `sans-serif`, so the new language renders fine without changes. For
   consistent typography across platforms, add a script-specific font to the
   body stack, e.g. `'Noto Sans Devanagari'` for Hindi. Don't preload fonts
   for scripts we don't ship — each family grows the render-blocking Google
   Fonts CSS, and stack order is glyph-sensitive.
5. Run the automated regression suite — it auto-discovers every catalog in
   `frontend/src/messages/` (the new one included, nothing to configure) and
   checks key parity, placeholder integrity, ICU plural validity, rich-text
   tag preservation, and that the sacred-German strings weren't translated:

   ```bash
   python3 multilingual-support/validate_languages.py
   ```

   All 6 tests must print `ok`. If the new language isn't in that script's
   `CLDR_PLURAL_CATEGORIES` dict yet, add its CLDR plural category set there
   for the strongest plural check (`add_language.py` does this for you);
   without it the test still runs but only checks generic ICU validity.
6. `npm run build`, then switch to the new language in Settings → App Language
   and click through a few pages. **Have a native speaker skim the result —
   LLM output is a strong first draft, not a final translation.** Ask them
   specifically whether any short grammar-term label reads as an unrelated
   everyday word out of context (the कारक trap from rule 10) — that's easy to
   miss on a normal read-through because the surrounding sentence still makes
   sense.
