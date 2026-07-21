# Multilingual UI Support — Handover Document

Branch: `i18n-multilingual-rtl-support`
Scope: UI-chrome multilingual support (English / Persian / Arabic / Hindi, extensible to more) with full RTL layout support and per-user language persistence. This directory (`multilingual-support/`) holds everything specific to this feature that isn't required to live elsewhere by framework convention — see the file index in §3.

---

## 1. What this feature does

Previously every menu, button, and label in the app was hardcoded English. Now:

- The **entire interface** (nav, dashboard, reader, vocabulary, grammar, cases, scenarios, writing, settings, contact, all shared components) renders in **English, Persian (فارسی), Arabic (العربية), or Hindi (हिन्दी)** — more languages can be added, see §6.
- Persian and Arabic render the whole app **right-to-left**: the `<html>` element gets `dir="rtl"`, layouts mirror automatically, and directional icons flip. Hindi is left-to-right.
- **German learning content never flips or translates.** German phrases, example sentences, patterns, and the writing editor stay left-to-right (`dir="ltr" lang="de"`) inside an RTL page.
- The chosen UI language is **persisted per-user in the backend** (`UserProfile.ui_language`) and survives reloads and restarts.
- This is **separate** from the existing "Your Language" setting (`translationLanguages`), which controls what language the *AI explanations* are written in. The UI language defaults from `translationLanguages[0]` on first load but is independently editable afterwards.

## 2. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| i18n library | `next-intl` | First-class Next.js App Router support, ICU MessageFormat, rich-text (`t.rich`) and raw-array (`t.raw`) rendering. |
| Locale routing | **Cookie-based, no URL prefixes** (`/fa/...` etc.) | Single-user local app; URLs stay clean; no route restructuring. The server reads the cookie during SSR so the very first paint is already in the right language *and* direction — no flash of English/LTR. |
| Cookie | `ui-locale` (path=/, max-age 1 year, SameSite=Lax) | Read server-side by `getRequestConfig`; written client-side on language change. |
| Persistence | Revived the dead `UserProfile.ui_language` column | Field already existed in the API surface; a one-time migration cleans old junk values. |
| RTL | `dir` attribute + Tailwind logical properties | No duplicated stylesheets; one layout works in both directions. |

### Data flow

```
First request:   browser cookie (ui-locale) ──► src/i18n/request.ts (getRequestConfig)
                                              └─► loads messages/<locale>.json
                                              └─► layout.tsx renders <html lang=… dir=…>

After mount:     LocaleSync (client) fetches profile
                   priority: profile.ui_language ► translationLanguages[0] ► "en"
                   if it differs from the cookie → set cookie + router.refresh()

User changes language (Settings → App Language):
                   PATCH /users/{id}/profile {ui_language}
                   set cookie → router.refresh()  (instant, no reload)
```

## 3. Files created

Framework-required files stay where Next.js/next-intl conventions expect them
(`frontend/src/i18n/`, `frontend/src/messages/`) — moving them would need
extra plugin configuration for no real benefit. Everything else specific to
this feature — docs, the validation suite, the language-scaffolding script —
lives in this directory instead of scattered at the repo root.

| File | Purpose |
|---|---|
| `frontend/src/i18n/config.ts` | `UI_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_COOKIE`, `isUiLocale()`, `dirFor(locale)` (returns `"rtl"` for fa/ar), `UI_LOCALE_LABELS` (native names). Edited automatically by `add_language.py`, see §6. |
| `frontend/src/i18n/request.ts` | next-intl `getRequestConfig`: reads the cookie, imports `../messages/${locale}.json`. |
| `frontend/src/lib/locale.ts` | `applyUiLocaleCookie(locale)` — writes the cookie from client code. `slugifyRuleName(name)` — derives the `grammar.ruleName_<slug>` catalog key for a `GrammarRule.name` (see §8). |
| `frontend/src/components/layout/LocaleSync.tsx` | Client component mounted in the root layout. Reconciles cookie vs. backend profile after mount (see data flow above). |
| `frontend/src/messages/en.json` | English catalog — **source of truth**. 776 keys. |
| `frontend/src/messages/fa.json`, `ar.json`, `hi.json` | Persian, Arabic, Hindi catalogs. Same 776-key structure (enforced by `validate_languages.py`); ICU plural categories per CLDR (fa/hi: one/other; ar: zero/one/two/few/many/other). |
| `multilingual-support/README.md` | This file. |
| `multilingual-support/adding-a-language.md` | The translation prompt template (shared by the manual and automated paths) and the wiring checklist. |
| `multilingual-support/validate_languages.py` | Automated regression suite — see §7. |
| `multilingual-support/add_language.py` | Scaffolds a whole new language end-to-end — see §6. |

## 4. Files modified

### Infrastructure
- `frontend/next.config.js` — wrapped with `createNextIntlPlugin()`.
- `frontend/src/app/layout.tsx` — rewritten: async `generateMetadata` via `getTranslations`, `getLocale()`, `<html lang={locale} dir={dirFor(locale)}>`, `<NextIntlClientProvider>`, mounts `<LocaleSync/>`; footer strings translated.
- `frontend/src/app/globals.css` — added **Vazirmatn** to the Google Fonts import and body font stack for Arabic-script glyph coverage.

### Backend
- `backend/models.py` — `UserProfile.ui_language` default changed `"fa"` → `None` (NULL = user never chose; LocaleSync then falls back to `translationLanguages[0]`).
- `backend/database.py` — one-time migration (`schema_meta` key `ui_language_reset_v1`) that NULLs old `ui_language` values once. Runs at startup, records itself, never runs again.
- `backend/routers/users.py` — unchanged; already accepted/returned `ui_language` on GET/PATCH profile. Note: PATCH with `ui_language: null` means "don't change" (standard PATCH semantics), not "clear".

### Pages & components (string extraction + RTL fixes)
All of: `cases/`, `contact/`, `dashboard/`, `grammar/`, `reader/`, `scenarios/`, `settings/`, `vocabulary/`, `writing/` pages, plus `TabNav`, `ConfirmLeaveDialog`, `AnalysisTable`, `AnnotationLayer`, `BookUpload`, `GrammarExplanationCard`, `PDFViewer`, `TextPanel`, `WordExplanationCard`, `FlashCard`, `QuizGame`, `DiffView`, `WritingTopicCard`.

The settings page additionally gained the **App Language** section (3-locale selector) which PATCHes the profile, writes the cookie, and calls `router.refresh()`.

## 5. Conventions used in the code (follow these when editing)

1. **Translation hooks**: `const t = useTranslations("namespace")` in client components; `getTranslations` in server code (only `layout.tsx`).
2. **Placeholders**: ICU — `t("wordsCount", { count })` with `{count, plural, one {…} other {…}}` in the catalog.
3. **Rich text**: `t.rich("key", { strong: (c) => <strong>{c}</strong> })`; catalogs contain `<strong>…</strong>`, `<em>`, `<a>`, `<code>`, `<b>`, `<mono>` tags.
4. **Arrays** (tips lists, keyChanges): stored as JSON arrays, rendered with `t.raw("key") as string[]`.
5. **Internal English data keys**: pedagogical data structures (case names, genders, exercise types, correction types) keep English keys internally and are translated at render time via template keys: `t(\`case_${cas}\`)`, `t(\`corrType_${type}\`)`, `t(\`prepMeaning_${key}\`)`.
6. **German content**: wrap in `dir="ltr" lang="de"` (titles, prompts, answers, patterns, the writing textarea). User/AI free-text of unknown language: `dir="auto"`.
7. **Deliberately-German UI labels** (Themen, Aufgabenstellung, Stärken, Analysiere…, etc. on the writing page) are *kept German in all three catalogs* — they were German in the original English UI as an immersion choice.
8. **Logical CSS only**: `ms-/me-` not `ml-/mr-`, `ps-/pe-`, `text-start/text-end`, `border-s/border-e`, `start-/end-`, `rounded-es-/rounded-ee-`. Directional icons (arrows, chevrons) get `rtl:-scale-x-100`. Never use physical left/right classes for layout.

## 6. How to add a new language (e.g. Turkish `tr`)

> Fastest path — one command does nearly all of the below:
> ```bash
> python3 multilingual-support/add_language.py --code tr --name Turkish
> ```
> See [`adding-a-language.md`](./adding-a-language.md) for what it does, its
> options, and the manual/paste-into-an-LLM path if you'd rather review the
> prompt yourself first.

1. `frontend/src/i18n/config.ts`: add `"tr"` to `UI_LOCALES`; add native label to `UI_LOCALE_LABELS`; if RTL (e.g. Hebrew/Urdu), add the code to the RTL set inside `dirFor`. *(automated)*
2. Create `frontend/src/messages/tr.json` with the **same key structure as `en.json`**. Run `python3 multilingual-support/validate_languages.py` (see §7) — it auto-discovers the new file and checks it. *(automated)*
3. `settings.uiLang.names` → add the language's name in *each* catalog (en/fa/ar/hi/tr). *(automated)*
4. Fonts (optional polish, not a blocker, human judgment call): the stack in `globals.css` ends in `sans-serif`, so any script Inter/Vazirmatn can't render falls back to an OS system font and still displays correctly. Add a dedicated font (e.g. `'Noto Sans Devanagari'` for Hindi) only when you add such a language and want consistent typography across platforms. Don't preload fonts for scripts we don't ship — each family grows the render-blocking Google Fonts CSS, and stack order is glyph-sensitive (see the comment above the `font-family` rule).
5. That's it — the settings selector, cookie flow, and backend persistence pick the new locale up automatically from `UI_LOCALES`.

## 7. Verification performed

- `npx tsc --noEmit` and `npm run build` pass.
- `python3 multilingual-support/validate_languages.py` — automated regression suite,
  auto-discovers every `frontend/src/messages/<code>.json` and checks each one against
  `en.json`: key parity, value shape (string vs. array, array length), placeholder integrity
  (`{count}`/`${tts}`-style tokens preserved verbatim), ICU plural block validity (mandatory
  `other` category, plus a per-locale CLDR category check for fa/ar/hi), rich-text tag
  preservation (`<strong>`/`<a>`/`<code>`/etc.), and that the deliberately-German "sacred"
  strings weren't translated. Run this after editing any catalog or adding a language — it's
  the single fastest way to catch the bug classes this branch actually hit (see §8 and
  `adding-a-language.md` rules 12–13 for what each check is defending against).
- Live test (backend :8000 + `next start` :3100):
  - No cookie → `<html lang="en" dir="ltr">`, English chrome.
  - `ui-locale=fa` → `<html lang="fa" dir="rtl">`, Persian chrome on dashboard/cases/settings/writing (server-rendered, correct on first paint).
  - `ui-locale=ar` → `<html lang="ar" dir="rtl">`, Arabic chrome.
  - `PATCH /users/demo-user-001/profile {"ui_language":"fa"}` persists and is returned on subsequent GETs.
  - Migration flag worked: `ui_language` was NULL on first read after upgrade.
- DB was reset to `ui_language = NULL` after testing, so the app starts in English until a language is chosen.

## 8. Known notes / gotchas

- **PATCH null semantics**: sending `ui_language: null` does *not* clear the stored value (Pydantic treats it as unset). There is currently no "reset to auto" in the UI; if ever needed, add a dedicated sentinel or endpoint.
- **`t()` throws on missing keys** (shows the key name in dev). When adding UI strings, add the key to *all* catalogs — `validate_languages.py` (§7) is the safety net worth wiring into CI. Two dynamic-key render sites (`grammar.ruleName_*` for AI-generated exercise types, `writing.corrType_*` for AI-generated correction types) intentionally catch the exception and fall back to the raw value instead of crashing, since those keys are fed by unconstrained Gemini output — see `ruleDisplayName`/`exerciseTypeLabel` in `grammar/page.tsx` and `correctionTypeLabel` in `writing/page.tsx`.
- **Quick-action chat prompts** (grammar page) are intentionally untranslated English — they're instructions *sent to the AI*, not display text; the tutor's reply language is controlled by the EN/second-language toggle.
- **`cases`, `writing` catalogs contain German-as-content**: don't "fix" German strings there into other languages.
- **Grammar-rule names** (`grammar.ruleName_<slug>`, one per `backend/seed_data.py` `GrammarRule`) are matched at render time via `slugifyRuleName(rule.name)` in `lib/locale.ts` — the only slug implementation in the repo. It must produce slugs matching the `ruleName_*` keys already baked into the message catalogs (`frontend/src/messages/*.json`). If a rule's `name` in the DB changes, its slug changes with it, so the matching `ruleName_<slug>` key must be updated in every catalog (otherwise the render falls back to the raw English name).
- **Recurring-term consistency**: when a language's catalog grows across multiple sessions (e.g. new keys added later, like the 50 `ruleName_*` entries added after the initial `fa`/`ar`/`hi` catalogs existed), grep the catalog for how the *same* recurring grammar term (case names, tense/mood names) was already rendered elsewhere before translating it again — it's easy to invent a second, competing translation of a term that already has an established rendering. This already happened once: Persian's `cases` namespace called Accusative "آکوزاتیو" while a later `grammar.ruleName_accusative_case` addition called it "حالت مفعولی" — fixed, but see `adding-a-language.md` rule 12 for the check to run next time.
- **Short technical terms can collide with everyday words** in the target language (e.g. Hindi "कर्म" alone reads as "action/karma", not "accusative case" — needs the कारक suffix to disambiguate). Same rule 12 in `adding-a-language.md` covers this; always have a native speaker specifically check short grammar labels in isolation, not just full sentences.
- The AI reply language system (`translationLanguages`, `lib/languages.ts`, 16 languages) is untouched and orthogonal to all of this.
- **Surprising-but-intentional cross-system interaction**: until a user explicitly picks an App Language, `LocaleSync` defaults the UI chrome from `translationLanguages[0]` (their primary AI-explanation language). For most users that position is `"en"` (the default), so nothing changes — but a user who had previously reordered their explanation languages so Persian sits at position `[0]` will see their UI chrome auto-switch to Persian the first time they load the app after this feature ships, even though they only ever touched the "Your Language" setting, not "App Language." This matches the documented design (§2 data flow), not a bug, but it's worth knowing before someone reports it as one.
- **RTL-inheritance trap for pre-existing components**: `TextPanel.tsx`'s `renderLines()` (renders the AI tutor's chat replies in the reader page) used `dir={rtl ? "rtl" : undefined}` in 3 spots, with `rtl` computed by sniffing the actual text content (`isRtl()`), not a language setting. This is pre-existing code, unchanged from `main` — it was always safe there because `main`'s `<html>` never had a `dir` attribute (always browser-default LTR). This branch's `<html dir={dirFor(locale)}>` can now be `"rtl"`, so the `undefined` fallback would have inherited RTL for LTR AI replies (e.g. an English tutor reply) whenever the UI language is Arabic/Persian — a real, visible bidi bug this feature would have introduced into otherwise-untouched code. Fixed to explicit `dir={rtl ? "rtl" : "ltr"}`, matching the pattern already used elsewhere in the same file and in `grammar/page.tsx`/`scenarios/page.tsx`. If you add another per-line/content-sniffed `dir` anywhere, always give both branches an explicit value — never rely on inheriting from an ancestor whose direction can now vary.
