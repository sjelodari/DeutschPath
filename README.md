<div align="center">

<img src="frontend/public/background.png" alt="DeutschPath" width="100%" style="border-radius:12px" /><br/>

# DeutschPath

### AI-powered German learning platform — runs entirely on your machine

<p>
  <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" /></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" /></a>
  <a href="https://aistudio.google.com"><img src="https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Platform-macOS_%7C_Windows-lightgrey?style=flat-square" />
  <img src="https://img.shields.io/badge/Database-SQLite_(local)-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/License-BUSL_1.1-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Languages-16_supported-F59E0B?style=flat-square" />
</p>

<p>
  <a href="https://buymeacoffee.com/sjelodari">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
  </a>
</p>

<br/>

<!-- Replace VIDEO_ID with your YouTube video ID once uploaded -->
<a href="https://youtu.be/iMbs5omO_aU">
  <img src="https://img.youtube.com/vi/iMbs5omO_aU/maxresdefault.jpg" width="700" />
</a>
<p align="center">
  <img src="https://img.shields.io/badge/Watch-YouTube-red?logo=youtube&style=for-the-badge" />
</p>
</div>

---

<div align="center">

**DeutschPath is a local-first German learning platform that runs entirely on your computer.**<br/>
Upload real German books, annotate words and grammar, chat with an AI tutor,<br/>
practice writing, and have full voice conversations — no subscription, no data leaving your machine.

</div>

---

## Features

<table>
<tr>
<td width="50%">

### 📖 Smart Book Reader
Upload any German PDF — text-based or scanned. Highlight a **word** to get instant analysis, or a **phrase** to identify the grammar rule. One click saves it to your study list. A persistent AI tutor chat lets you ask questions about anything on the current page.

- Gemini Vision OCR for scanned pages
- Word analysis: gender, case, conjugation, CEFR level, example sentences
- Translation in your selected language(s)
- Grammar rule detection from selected text
- In-page annotations and highlights
- AI tutor chat with Gemini neural voice

</td>
<td width="50%">

### 🗂 Spaced Repetition Vocabulary
Your saved words are reviewed using the **SM-2 algorithm** — the same method used by Anki. The app automatically schedules each word for the optimal review moment.

- 3-button review: **Again / Hard / Got it** (keyboard shortcuts ← ↓ →)
- Browse and filter by word type or CEFR level
- Quiz mode for extra drilling
- Gemini neural TTS pronunciation per word

</td>
</tr>
<tr>
<td width="50%">

### 📚 Grammar Roadmap
A structured **A1 → C2 grammar roadmap** with 15 pre-built rules. Each rule has its own AI tutor that gives exercises, corrects answers in real time, and advances you when you're ready.

- Level-locked progression
- AI tutor chat per grammar rule
- Grammar notes captured in the reader link back here
- Explanations in your selected language(s)

</td>
<td width="50%">

### 🎭 Conversation Scenarios
Practice real German in 10 role-play scenarios — grocery store, restaurant, bank, doctor, job interview, and more. The AI agent stays in character and adapts to your CEFR level.

- Voice input via microphone (Web Speech API)
- Gemini neural TTS voice output with optional auto-play
- Gentle grammar correction after each message
- Vocabulary highlights from the AI response
- Explanations in your selected language(s)

</td>
</tr>
<tr>
<td width="50%">

### ✍️ Writing Practice
Select a topic by level and type (essay, email, story, exam prompt), write in German, and get detailed AI feedback with a scored diff view.

- Topics filtered by CEFR level and writing type
- Corrections with diff highlighting (original vs corrected)
- Error type breakdown: grammar, spelling, punctuation, word choice, style
- Vocabulary upgrade suggestions
- Session history

</td>
<td width="50%">

### 📐 Cases Reference & Practice
A complete German case reference covering all articles, adjective endings, and personal pronouns — with a **fill-in-the-blank practice mode** and live scoring.

- Definite, indefinite, and negative articles
- Weak, mixed, and strong adjective endings
- Personal pronouns (Akkusativ + Dativ)
- Score feedback per answer

</td>
</tr>
</table>

---

## 🌍 16 Supported Languages

AI explanations are delivered in your chosen language(s) — pick **English only**, a **second language only**, or **both**. Configurable in Settings:

<div align="center">

| | | | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🇮🇷 Persian | 🇸🇦 Arabic | 🇷🇺 Russian | 🇫🇷 French | 🇪🇸 Spanish | 🇹🇷 Turkish | 🇨🇳 Chinese | 🇯🇵 Japanese |
| 🇰🇷 Korean | 🇵🇹 Portuguese | 🇮🇹 Italian | 🇵🇱 Polish | 🇳🇱 Dutch | 🇸🇪 Swedish | 🇺🇦 Ukrainian | 🇬🇧 English |

</div>

---

## 🚀 Quick Start

No installation wizard. Just double-click.

<table>
<tr>
<td width="50%">

**🍎 macOS**

1. **First time:** double-click **`start.command`** — automatically installs Python, Node.js, and all packages, then launches the app (~1–2 min)
2. **After setup:** double-click **`DeutschPath.app`**

</td>
<td width="50%">

**🪟 Windows**

1. **First time:** double-click **`DeutschPath.bat`** — automatically installs Python 3 and Node.js 20 LTS if missing, then launches the app
2. **After setup:** use  `DeutschPath.vbs` and later it generates shortcuts which you can add to your desktop

</td>
</tr>
</table>

The launcher:
- Installs all Python and Node.js dependencies on first run (~1–2 min)
- Starts the FastAPI backend (port 8000) and Next.js frontend (port 3000) silently in the background
- Opens a browser progress page, then redirects to the app when ready
- On every re-launch: detects the servers are already up and opens the browser in ~5 seconds without restarting anything

---

## 🔑 Getting Your Gemini API Key

DeutschPath uses Google's Gemini API. The free tier covers regular personal use. 

1. Go to **[aistudio.google.com](https://aistudio.google.com)** — sign in with any Google account
2. Click **Get API key → Create API key**
3. Copy the key (it starts with `AQ.` in current AI Studio versions)
4. Open DeutschPath → **Settings** → paste and save

> **Free tier limits (as of June 2026):** 10 requests/min · 250,000 tokens/min · 250 requests/day for Gemini 2.5 Flash text. The TTS model (`gemini-2.5-flash-preview-tts`) has **no free tier** — voice features (auto-play in scenarios and the reader) are billed at paid rates. Keep auto-play off if you want to stay on the free tier.

---

### Important Reminder!
When you have finished using the platform and want to exit, do NOT simply close the tab. First, shut down the platform by clicking the button in the top right corner, and only then close the tab.

## 🛠 Technologies & Tools

| Category | Tool / Library | Version | Purpose |
|---|---|---|---|
| **UI Framework** | Next.js | 15 | App Router, server components, routing |
| **UI Runtime** | React | 19 | Component rendering |
| **Language** | TypeScript | 5 (strict) | Type safety across the frontend |
| **Styling** | Tailwind CSS | 3 | Utility-first CSS, dark mode |
| **State** | Zustand | — | Global UI state (user level, languages) |
| **Icons** | lucide-react | — | SVG icon set |
| **API Framework** | FastAPI | 0.111 | REST API, async request handling |
| **Language** | Python | 3.10+ | Backend runtime |
| **ORM** | SQLAlchemy | 2 | Database models and queries |
| **Server** | Uvicorn | — | ASGI server for FastAPI |
| **Database** | SQLite | — | Local file database, zero config |
| **AI — text** | Google Gemini 2.5 Flash | — | Analysis, chat, OCR, grammar, writing |
| **AI — voice** | Gemini 2.5 Flash TTS Preview | — | Neural TTS, PCM16 audio output |
| **PDF — text** | pdfplumber | — | Text extraction from native PDFs |
| **PDF — scanned** | Gemini Vision | — | OCR fallback for image-based PDFs |
| **Speech input** | Web Speech API | browser | Microphone input in scenarios |
| **Spaced repetition** | SM-2 algorithm | — | Vocabulary review scheduling |
| **Image processing** | Pillow | — | Launcher icon generation (.icns / .ico) |
| **Launcher** | Python http.server + subprocess | — | Cross-platform app launcher |

---

## 🏗 Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                        USER'S MACHINE                            ║
║                                                                  ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │              Browser  (localhost:3000)                    │   ║
║  │           Next.js 15  ·  React 19  ·  TypeScript          │   ║
║  │                                                           │   ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   ║
║  │  │  Reader  │ │ Vocab /  │ │ Grammar  │ │ Writing  │      │   ║
║  │  │  + Chat  │ │  Flashcd │ │ Roadmap  │ │ Practice │      │   ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │   ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   ║
║  │  │Scenarios │ │  Cases   │ │Dashboard │ │ Settings │      │   ║
║  │  │+ Voice   │ │ & Drills │ │& Progress│ │& API Key │      │   ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │   ║
║  └────────────────────────┬──────────────────────────────────┘   ║
║                           │  HTTP/JSON  (fetch)                  ║
║  ┌────────────────────────▼──────────────────────────────────┐   ║
║  │              FastAPI  (localhost:8000)                    │   ║
║  │                                                           │   ║
║  │  Routers                    Services                      │   ║
║  │  ├─ /books   (reader,OCR)   ├─ ai_service.py              │   ║
║  │  ├─ /words   (vocab, SM-2)  │    └─ all Gemini calls      │   ║
║  │  ├─ /grammar (roadmap)      ├─ pdf_service.py             │   ║
║  │  ├─ /scenarios (chat)       │    └─ pdfplumber + OCR      │   ║
║  │  ├─ /writing  (feedback)    ├─ tts_service.py             │   ║
║  │  ├─ /tts      (audio out)   └─ usage_tracker.py           │   ║
║  │  ├─ /settings (key, stats)       └─ usage.json            │   ║
║  │  └─ /users    (profile)                                   │   ║
║  └──────────┬─────────────────────────┬──────────────────────┘   ║
║             │                         │                          ║
║  ┌──────────▼──────────┐              │  HTTPS                   ║
║  │   SQLite Database   │              │                          ║
║  │   deutschpath.db    │    ╔─────────▼──────────────────╗       ║
║  │                     │    ║   Google Gemini API        ║       ║
║  │  Books · Words      │    ║                            ║       ║
║  │  Grammar · Sessions │    ║  gemini-2.5-flash          ║       ║
║  │  Writing · Profile  │    ║  (text · vision · chat)    ║       ║
║  │  Annotations        │    ║                            ║       ║
║  └─────────────────────┘    ║  gemini-2.5-flash-tts      ║       ║
║                              ║  (neural voice output)    ║       ║
║                              ╚═══════════════════════════╝       ║
╚══════════════════════════════════════════════════════════════════╝
```

### Key design decisions

- **Single-user, local-first.** No authentication, no cloud database. All user data (vocabulary, progress, grammar mastery, uploaded PDFs) stays in a single SQLite file on your machine.
- **Lazy Gemini client.** `_get_client()` in `ai_service.py` initialises the Gemini SDK on first use. If no API key is set it raises a friendly error shown in the Settings UI — the app starts cleanly without a key.
- **Auto-migration.** `database.py` runs `CREATE TABLE IF NOT EXISTS` plus a `_migrate_sqlite()` pass on every startup to add new columns to existing tables without wiping data. No Alembic, no migration files.
- **Separate TTS tracking.** Text and TTS calls are recorded in distinct buckets in `usage.json` because they have very different per-token prices ($0.30/$2.50 vs $0.50/$10.00 per 1M). The Settings page shows both breakdowns and links to AI Studio for accurate real-time figures.
- **Neural TTS only.** All voice output uses `gemini-2.5-flash-preview-tts` (PCM16 audio wrapped in a WAV header server-side). There is no browser `speechSynthesis` fallback — consistent quality over silent degradation.
- **Bidirectional text.** When the AI responds in a right-to-left language (Persian, Arabic) and includes German example sentences, the reader chat wraps each German segment in `dir="ltr" unicode-bidi: isolate` so word order renders correctly in both directions simultaneously.

---

## 💻 Developer Setup

**Backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

<details>
<summary>Environment variables</summary>

**`backend/.env`**
```env
GEMINI_API_KEY=your_key_here
FRONTEND_URL=http://localhost:3000
```

**`frontend/.env.local`** (copy from `.env.local.example`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USER_ID=demo-user-001
```
</details>

<details>
<summary>Project structure</summary>

```
DeutschPath/
├── backend/
│   ├── main.py               # FastAPI app entry point — mounts all routers
│   ├── models.py             # SQLAlchemy ORM models
│   ├── database.py           # SQLite engine, init_db(), auto-migration, seeding
│   ├── seed_data.py          # 15 grammar rules (A1→C2) + 10 scenarios
│   ├── requirements.txt
│   ├── routers/
│   │   ├── books.py          # PDF upload, OCR, page text, reader chat, transcription
│   │   ├── words.py          # Vocabulary CRUD, SM-2 review, batch analysis
│   │   ├── grammar.py        # Grammar roadmap, exercises, mastery, AI practice chat
│   │   ├── scenarios.py      # Scenario listing, conversation sessions
│   │   ├── writing.py        # Writing topics, AI analysis, session history
│   │   ├── tts.py            # Gemini TTS endpoint → WAV response
│   │   ├── settings.py       # API key, usage stats, backup/restore
│   │   └── users.py          # User profile, daily goal, stats
│   └── services/
│       ├── ai_service.py     # All Gemini calls (analysis, chat, OCR, TTS, transcription)
│       ├── pdf_service.py    # PDF text extraction (pdfplumber + Gemini OCR fallback)
│       ├── tts_service.py    # gTTS stub (unused — kept for reference)
│       └── usage_tracker.py  # Token/cost tracking per call type → usage.json
├── frontend/
│   └── src/
│       ├── app/              # Next.js pages: reader · vocabulary · grammar · writing
│       │                     #   scenarios · cases · dashboard · settings · contact
│       ├── components/
│       │   ├── layout/       # TabNav, ConfirmLeaveDialog, LevelBadge
│       │   ├── reader/       # PDFViewer, TextPanel, AnalysisTable,
│       │   │                 #   WordExplanationCard, GrammarExplanationCard, BookUpload
│       │   ├── vocabulary/   # FlashCard, QuizGame
│       │   └── writing/      # WritingTopicCard, DiffView
│       ├── hooks/
│       │   └── useTheme.ts   # Dark/light mode (persisted in localStorage)
│       └── lib/
│           ├── api.ts        # All fetch calls to the backend (single source of truth)
│           ├── store.ts      # Zustand store — userLevel, translationLanguages, UI state
│           ├── languages.ts  # 16 supported languages with RTL flags
│           └── speak.ts      # Browser TTS wrapper (legacy, not used for main TTS)
├── launcher.py               # Cross-platform launcher — mini HTTP progress server + subprocess
├── DeutschPath.app/          # macOS app bundle — double-click to launch
├── DeutschPath.bat           # Windows first-run setup (auto-installs Python + Node.js)
├── DeutschPath.vbs           # Windows silent launcher (no terminal window)
└── frontend/public/
    ├── logo.png              # App logo — source for .icns (Mac) and .ico (Windows)
    ├── background.png        # README banner and Contact page background
    └── profile.png           # Author photo (Contact page)
```
</details>

---

## 🤝 Contributing

Contributions are welcome. For non-trivial changes, please **open an issue first** to discuss what you'd like to change — this avoids wasted effort if the direction doesn't fit the project.
---

## ☕ Support

DeutschPath started as a **hobby weekend project** — born out of personal frustration with existing German learning tools that are either too expensive, too gamified, or don't let you learn from real books. It is free and open source.

If it saves you time or makes learning German a little less painful, consider buying a coffee — it keeps the weekend sessions going.

<a href="https://buymeacoffee.com/sjelodari">
  <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
</a>

---

## 📄 License

**Dual License: AGPL v3 + Commercial** — see [`LICENSE`](LICENSE) for the full text.

- **Free** under [AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html) for personal, educational, open-source, and non-commercial use. Any modifications you distribute must also be released under AGPL v3.
- **Commercial use** (selling it, bundling it in a paid product, or offering it as a hosted service without releasing your source) requires a separate commercial license — contact [saber.jelodarii@gmail.com](mailto:saber.jelodarii@gmail.com)

> By submitting a pull request you agree that your contribution may also be distributed under a commercial license by the project owner.

---

<div align="center">

Made by **[Saber Jelodari](https://www.linkedin.com/in/saber-jelodari/)**

<sub>AI responses are generated by Gemini and may occasionally contain mistakes — always verify important German.</sub>

</div>
