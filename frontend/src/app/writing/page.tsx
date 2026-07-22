"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import {
  PenLine, Filter, ChevronDown, Loader2, AlertCircle,
  Star, BarChart2, CheckCircle2, BookOpen, Lightbulb,
  ThumbsUp, ArrowRight, RotateCcw, Clock, FileText,
  GraduationCap, Trash2, History, X, BookmarkPlus, Download,
} from "lucide-react";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { WritingTopicCard } from "@/src/components/writing/WritingTopicCard";
import { DiffView } from "@/src/components/writing/DiffView";
import {
  listWritingTopics,
  analyzeWriting,
  listWritingSessions,
  deleteWritingSessions,
  batchAnalyzeWords,
  saveWord,
} from "@/src/lib/api";
import { useAppStore } from "@/src/lib/store";

// ── Types ──────────────────────────────────────────────────────────────────
interface WritingTopic {
  id: string;
  title: string;
  description: string;
  prompt: string;
  level: string;
  writing_type: string;
  exam: string | null;
  word_count_min: number;
  word_count_max: number;
  time_limit_min: number | null;
}

interface Correction {
  type: "grammar" | "spelling" | "punctuation" | "capitalization" | "word_choice" | "style";
  original: string;
  corrected: string;
  explanation: string;
}

interface VocabSuggestion {
  original: string;
  suggestion: string;
  reason: string;
}

interface Feedback {
  overall_score: number;
  level_achieved: string;
  word_count: number;
  corrected_text: string;
  corrections: Correction[];
  vocabulary_suggestions: VocabSuggestion[];
  structure: { score: number; feedback: string };
  exam_feedback: string | null;
  general_feedback: string;
  strengths: string[];
  improvements: string[];
}

type FeedbackTab = "diff" | "corrections" | "vocabulary" | "structure";

// ── Color coding for correction types ─────────────────────────────────────
const correctionColors: Record<string, { badge: string; bg: string }> = {
  grammar:       { badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",       bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40" },
  spelling:      { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/40" },
  punctuation:   { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/40" },
  capitalization:{ badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",  bg: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40" },
  word_choice:   { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40" },
  style:         { badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/40" },
};

/** `type` comes from Gemini's free-text correction output, not a fixed enum —
 *  fall back to the raw value if it's ever outside the catalog's known keys. */
function correctionTypeLabel(t: (key: string) => string, type: string): string {
  try {
    return t(`corrType_${type}`);
  } catch {
    return type.replace("_", " ");
  }
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const WRITING_TYPES = [
  "Beschreibung", "Erzählung", "Erörterung", "Stellungnahme",
  "Formeller Brief", "Informelle E-Mail", "Formelle E-Mail",
  "Bericht", "Kommentar", "Bewerbungsschreiben", "Leserbrief",
  "Zusammenfassung", "Diagrammbeschreibung",
];
const EXAMS = [
  "Goethe A1", "Goethe A2", "Goethe B1", "Goethe B2", "Goethe C1", "Goethe C2",
  "TestDaF", "DSH", "TELC A2", "TELC B1", "TELC B2", "TELC C1", "OeSD B2",
];

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function ScoreCircle({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "text-green-600 dark:text-green-400"
    : score >= 6 ? "text-blue-600 dark:text-blue-400"
    : score >= 4 ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400";
  const stroke = score >= 8 ? "#22c55e" : score >= 6 ? "#3b82f6" : score >= 4 ? "#eab308" : "#ef4444";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
          className="stroke-slate-200 dark:stroke-slate-700" />
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
          stroke={stroke} strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={clsx("text-2xl font-bold leading-none", color)}>{score.toFixed(1)}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">/10</span>
      </div>
    </div>
  );
}

// ── PDF export ─────────────────────────────────────────────────────────────
function generatePrintHTML(
  feedback: Feedback,
  topic: WritingTopic | null,
  userText: string,
  dateStr: string,
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const corrTypeColor: Record<string, string> = {
    grammar: "#dc2626", spelling: "#ea580c", punctuation: "#ea580c",
    capitalization: "#ca8a04", word_choice: "#2563eb", style: "#7c3aed",
  };

  const correctionRows = feedback.corrections.map(c => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">
        <span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:${corrTypeColor[c.type] ?? "#64748b"}">
          ${esc(c.type.replace("_", " "))}
        </span>
      </td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;font-family:monospace;font-size:12px;text-decoration:line-through;color:#ef4444">${esc(c.original)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;font-family:monospace;font-size:12px;color:#16a34a;font-weight:600">${esc(c.corrected)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;font-size:12px;color:#374151">${esc(c.explanation)}</td>
    </tr>`).join("");

  const vocabRows = feedback.vocabulary_suggestions.map(v => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-family:monospace;font-size:12px;text-decoration:line-through;color:#64748b">${esc(v.original)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-family:monospace;font-size:12px;color:#2563eb;font-weight:700">${esc(v.suggestion)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;color:#374151">${esc(v.reason)}</td>
    </tr>`).join("");

  const strengthsList = feedback.strengths.map(s =>
    `<li style="margin:3px 0;font-size:13px;color:#166534">&#10003; ${esc(s)}</li>`).join("");

  const improvementsList = feedback.improvements.map(s =>
    `<li style="margin:3px 0;font-size:13px;color:#1e40af">&#8594; ${esc(s)}</li>`).join("");

  const scoreColor = feedback.overall_score >= 8 ? "#16a34a"
    : feedback.overall_score >= 6 ? "#2563eb"
    : feedback.overall_score >= 4 ? "#ca8a04" : "#dc2626";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <title>DeutschPath – Writing Analysis</title>
  <style>
    @page { margin: 18mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 13px; color: #1e293b; line-height: 1.6; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 2px; color: #1e293b; }
    h2 { font-size: 14px; font-weight: 700; color: #334155; margin: 20px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; page-break-after: avoid; }
    p { margin: 0 0 6px; }
    table { width: 100%; border-collapse: collapse; font-family: sans-serif; page-break-inside: avoid; }
    th { background: #f8fafc; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; color: #64748b; }
    .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; background: #f8fafc; margin: 0 0 10px; font-family: sans-serif; font-size: 13px; white-space: pre-wrap; line-height: 1.7; }
    .corrected-box { border-color: #bbf7d0; background: #f0fdf4; }
    .score-pill { display: inline-block; font-size: 28px; font-weight: 900; color: ${scoreColor}; font-family: sans-serif; }
    .meta-pill { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; font-family: sans-serif; margin-right: 6px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .strbox { border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 6px; padding: 10px 12px; }
    .impbox { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 6px; padding: 10px 12px; }
    .exam-box { border: 1px solid #fde68a; background: #fffbeb; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; font-family: sans-serif; font-size: 13px; }
    .footer { margin-top: 30px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; font-family: sans-serif; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      <h1>Deutsch<span style="color:#6366f1">Path</span> &mdash; Writing Analysis</h1>
      <p style="font-size:12px;color:#64748b;font-family:sans-serif;margin:0">${esc(dateStr)}</p>
    </div>
    <div style="text-align:right;font-family:sans-serif;">
      <div class="score-pill">${feedback.overall_score.toFixed(1)}<span style="font-size:14px;font-weight:400;color:#94a3b8">/10</span></div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">Level achieved: <strong>${esc(feedback.level_achieved)}</strong> &nbsp;|&nbsp; ${feedback.word_count} words</div>
    </div>
  </div>

  <!-- Topic info -->
  ${topic ? `
  <div style="font-family:sans-serif;margin-bottom:14px;">
    <span class="meta-pill" style="background:#ede9fe;color:#5b21b6">${esc(topic.level)}</span>
    <span class="meta-pill" style="background:#f1f5f9;color:#334155">${esc(topic.writing_type)}</span>
    ${topic.exam ? `<span class="meta-pill" style="background:#fef9c3;color:#713f12">${esc(topic.exam)}</span>` : ""}
    <strong style="font-size:15px;color:#1e293b">${esc(topic.title)}</strong>
  </div>
  <div style="font-family:sans-serif;font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-bottom:14px;">
    <strong>Aufgabenstellung:</strong> ${esc(topic.prompt)}
  </div>` : ""}

  <!-- General feedback -->
  <div style="font-family:sans-serif;font-size:13px;color:#334155;margin-bottom:14px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;">
    ${esc(feedback.general_feedback)}
  </div>

  <h2>Ihr Originaltext</h2>
  <div class="box">${esc(userText)}</div>

  <h2>Korrigierte Version</h2>
  <div class="box corrected-box">${esc(feedback.corrected_text)}</div>

  ${feedback.corrections.length > 0 ? `
  <h2>Korrekturen (${feedback.corrections.length})</h2>
  <table>
    <thead><tr>
      <th style="width:100px">Typ</th>
      <th style="width:160px">Original</th>
      <th style="width:160px">Korrigiert</th>
      <th>Erklärung</th>
    </tr></thead>
    <tbody>${correctionRows}</tbody>
  </table>` : `
  <h2>Korrekturen</h2>
  <p style="color:#16a34a;font-family:sans-serif">&#10003; Keine Fehler gefunden — ausgezeichnet!</p>`}

  ${feedback.vocabulary_suggestions.length > 0 ? `
  <h2>Vokabelvorschläge</h2>
  <table>
    <thead><tr>
      <th style="width:160px">Original</th>
      <th style="width:160px">Vorschlag</th>
      <th>Begründung</th>
    </tr></thead>
    <tbody>${vocabRows}</tbody>
  </table>` : ""}

  <h2>Struktur &amp; Aufbau</h2>
  <div style="font-family:sans-serif;font-size:13px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:10px;">
    <strong>Strukturwertung: ${feedback.structure.score}/10</strong><br/>
    <span style="color:#475569">${esc(feedback.structure.feedback)}</span>
  </div>

  ${feedback.exam_feedback ? `
  <div class="exam-box">
    <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#92400e">Prüfungsfeedback${topic?.exam ? ` — ${esc(topic.exam)}` : ""}</strong><br/>
    <span style="color:#78350f">${esc(feedback.exam_feedback)}</span>
  </div>` : ""}

  ${(feedback.strengths.length > 0 || feedback.improvements.length > 0) ? `
  <h2>Stärken &amp; Verbesserungspotenzial</h2>
  <div class="two-col">
    ${feedback.strengths.length > 0 ? `
    <div class="strbox">
      <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#166534;font-family:sans-serif">Stärken</strong>
      <ul style="margin:6px 0 0;padding-left:16px">${strengthsList}</ul>
    </div>` : "<div></div>"}
    ${feedback.improvements.length > 0 ? `
    <div class="impbox">
      <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#1e40af;font-family:sans-serif">Verbesserungspotenzial</strong>
      <ul style="margin:6px 0 0;padding-left:16px">${improvementsList}</ul>
    </div>` : "<div></div>"}
  </div>` : ""}

  <div class="footer">Generated by DeutschPath &bull; deutschpath.app</div>

</body>
</html>`;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function WritingPage() {
  const t = useTranslations("writing");
  const { userLevel, translationLanguages } = useAppStore();

  // Filter state
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [examFilter, setExamFilter] = useState<string>("");

  // Topic list
  const [topics, setTopics] = useState<WritingTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState("");

  // Selection & editor
  const [selectedTopic, setSelectedTopic] = useState<WritingTopic | null>(null);
  const [userText, setUserText] = useState("");

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackTab, setFeedbackTab] = useState<FeedbackTab>("diff");

  // Session history
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Vocab selection (corrected panel)
  type VocabBtn = { text: string; x: number; y: number };
  const [vocabBtn, setVocabBtn] = useState<VocabBtn | null>(null);
  const [vocabSaving, setVocabSaving] = useState(false);
  const [vocabToast, setVocabToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load topics
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setTopicsError("");
    try {
      const data = await listWritingTopics(
        levelFilter || undefined,
        typeFilter || undefined,
        examFilter || undefined,
      );
      setTopics(data);
    } catch (e: any) {
      setTopicsError(e.message || t("errLoadTopics"));
    } finally {
      setTopicsLoading(false);
    }
  }, [levelFilter, typeFilter, examFilter]);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await listWritingSessions();
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Detect text selection within the corrected text panel
  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setVocabBtn(null); return; }
      const text = sel.toString().trim();
      if (!text || text.length < 2) { setVocabBtn(null); return; }
      try {
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer as Node;
        const el = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor as Element;
        if (!el?.closest(".corrected-text")) { setVocabBtn(null); return; }
        const rect = range.getBoundingClientRect();
        setVocabBtn({ text, x: rect.left + rect.width / 2, y: rect.top });
      } catch {
        setVocabBtn(null);
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  const saveVocabFromWriting = async () => {
    if (!vocabBtn || vocabSaving) return;
    setVocabSaving(true);
    try {
      const results = await batchAnalyzeWords([vocabBtn.text], userLevel || "B1", translationLanguages?.length ? translationLanguages : [{ code: "en", name: "English" }]);
      if (results[0]) await saveWord(results[0]);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setVocabToast(t("savedToast", { text: vocabBtn.text }));
      toastTimer.current = setTimeout(() => setVocabToast(""), 2500);
    } catch {
      // silent fail
    } finally {
      setVocabSaving(false);
      setVocabBtn(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleSelectTopic = (topic: WritingTopic) => {
    setSelectedTopic(topic);
    setFeedback(null);
    setAnalyzeError("");
    setUserText("");
  };

  const handleAnalyze = async () => {
    if (!userText.trim() || !selectedTopic) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const result = await analyzeWriting(selectedTopic.id, userText, userLevel || "B1");
      setFeedback(result.feedback);
      setFeedbackTab("diff");
    } catch (e: any) {
      setAnalyzeError(e.message || t("errAnalyze"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteSessions = async () => {
    if (!confirm(t("confirmDeleteSessions"))) return;
    await deleteWritingSessions();
    setSessions([]);
  };

  const wc = wordCount(userText);
  const minWords = selectedTopic?.word_count_min ?? 50;
  const maxWords = selectedTopic?.word_count_max ?? 500;
  const canAnalyze = wc >= minWords && !analyzing && !!selectedTopic && !!userText.trim();

  const groupedCorrections = useMemo(() => {
    if (!feedback?.corrections) return {};
    return feedback.corrections.reduce<Record<string, Correction[]>>((acc, c) => {
      const k = c.type || "grammar";
      if (!acc[k]) acc[k] = [];
      acc[k].push(c);
      return acc;
    }, {});
  }, [feedback]);

  const handleExportPDF = () => {
    if (!feedback) return;
    const dateStr = new Date().toLocaleDateString("de-DE", {
      year: "numeric", month: "long", day: "numeric",
    });
    const html = generatePrintHTML(feedback, selectedTopic, userText, dateStr);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-20 pb-10">

      {/* Floating vocab save button */}
      {vocabBtn && (
        <div
          className="fixed z-[70] pointer-events-auto"
          style={{ left: vocabBtn.x, top: vocabBtn.y - 46, transform: "translateX(-50%)" }}
        >
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={saveVocabFromWriting}
            disabled={vocabSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all whitespace-nowrap disabled:opacity-70"
          >
            {vocabSaving ? <Loader2 size={11} className="animate-spin" /> : <BookmarkPlus size={11} />}
            {t("saveSelection", { text: vocabBtn.text.length > 16 ? vocabBtn.text.slice(0, 16) + "…" : vocabBtn.text })}
          </button>
          <div className="flex justify-center -mt-px">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-emerald-600" />
          </div>
        </div>
      )}

      {/* Vocab saved toast */}
      {vocabToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
          ✓ {vocabToast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow">
              <PenLine size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowHistory(h => !h); if (!showHistory) loadSessions(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <History size={15} />
            {t("history")}
          </button>
        </div>

        {/* ── History Panel (overlay) ── */}
        {showHistory && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("sessionHistory")}</h2>
                <div className="flex gap-2">
                  {sessions.length > 0 && (
                    <button onClick={handleDeleteSessions}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={13} /> {t("clearAll")}
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {sessionsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={20} className="animate-spin text-brand-500" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-10">
                    {t("noSessions")}
                  </p>
                ) : sessions.map(s => (
                  <div key={s.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
                        {s.topic?.title ?? t("freeWriting")}
                      </span>
                      {s.topic?.level && <LevelBadge level={s.topic.level} size="sm" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {s.score != null && (
                        <span className="font-semibold text-brand-600 dark:text-brand-400">
                          {s.score.toFixed(1)}/10
                        </span>
                      )}
                      <span>{new Date(s.created_at).toLocaleDateString()}</span>
                      <span>{t("wordsCount", { count: wordCount(s.user_text) })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Filter size={14} /> {t("filterLabel")}
            </span>

            {/* Level pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setLevelFilter("")}
                className={clsx("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  levelFilter === "" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >{t("allLevels")}</button>
              {LEVELS.map(l => (
                <button key={l}
                  onClick={() => setLevelFilter(l === levelFilter ? "" : l)}
                  className={clsx("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    levelFilter === l ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >{l}</button>
              ))}
            </div>

            {/* Type dropdown */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="appearance-none ps-3 pe-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t("allTypes")}</option>
                {WRITING_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
              </select>
              <ChevronDown size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Exam dropdown */}
            <div className="relative">
              <select
                value={examFilter}
                onChange={e => setExamFilter(e.target.value)}
                className="appearance-none ps-3 pe-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t("allExams")}</option>
                <option value="__none__">{t("noExam")}</option>
                {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <ChevronDown size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {(levelFilter || typeFilter || examFilter) && (
              <button
                onClick={() => { setLevelFilter(""); setTypeFilter(""); setExamFilter(""); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <X size={12} /> {t("clear")}
              </button>
            )}

            <span className="ms-auto text-xs text-slate-400 dark:text-slate-500">
              {t("topicsCount", { count: topics.length })}
            </span>
          </div>
        </div>

        {/* ── Main 2-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left: Topic list ── */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("topicsHeader")}</h2>
              </div>
              <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {topicsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={22} className="animate-spin text-brand-500" />
                  </div>
                ) : topicsError ? (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm p-3">
                    <AlertCircle size={16} /> {topicsError}
                  </div>
                ) : topics.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">{t("noTopics")}</p>
                ) : topics.map(topic => (
                  <WritingTopicCard
                    key={topic.id}
                    topic={topic}
                    selected={selectedTopic?.id === topic.id}
                    onClick={() => handleSelectTopic(topic)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="lg:col-span-3">
            {!selectedTopic ? (
              <div className="h-full min-h-64 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <PenLine size={28} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t("emptyTitle")}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t("emptySubtitle")}
                </p>
              </div>
            ) : !feedback ? (
              /* ── Editor view ── */
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Topic header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3 mb-2">
                    <LevelBadge level={selectedTopic.level} size="md" />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight flex-1" dir="ltr" lang="de">
                      {selectedTopic.title}
                    </h2>
                    {selectedTopic.exam && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 font-medium shrink-0">
                        <GraduationCap size={11} /> {selectedTopic.exam}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="inline-flex items-center gap-1"><FileText size={11} /> {selectedTopic.writing_type}</span>
                    <span>·</span>
                    <span dir="ltr">{t("wordRange", { min: selectedTopic.word_count_min, max: selectedTopic.word_count_max })}</span>
                    {selectedTopic.time_limit_min && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1" dir="ltr"><Clock size={11} /> {t("minutes", { count: selectedTopic.time_limit_min })}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Prompt box */}
                <div className="mx-5 mt-4 p-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700/40">
                  <p className="text-sm font-medium text-brand-800 dark:text-brand-200 mb-1.5" dir="auto">{t("taskLabel")}</p>
                  <p className="text-sm text-brand-700 dark:text-brand-300 leading-relaxed whitespace-pre-line" dir="ltr" lang="de">
                    {selectedTopic.prompt}
                  </p>
                </div>

                {/* Textarea */}
                <div className="p-5">
                  <textarea
                    value={userText}
                    onChange={e => setUserText(e.target.value)}
                    placeholder={t("editorPlaceholder")}
                    rows={14}
                    dir="ltr"
                    lang="de"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm p-4 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed"
                  />

                  {/* Word count bar */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex-1 me-3">
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all duration-300",
                            wc >= minWords ? "bg-green-500" : "bg-brand-500"
                          )}
                          style={{ width: `${Math.min(100, (wc / maxWords) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={clsx(
                      "text-xs font-medium tabular-nums",
                      wc < minWords ? "text-slate-400 dark:text-slate-500"
                        : wc > maxWords ? "text-orange-600 dark:text-orange-400"
                        : "text-green-600 dark:text-green-400"
                    )} dir="ltr">
                      {wc} / {minWords}–{maxWords}
                    </span>
                  </div>

                  {wc < minWords && wc > 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {t("wordsToMin", { count: minWords - wc })}
                    </p>
                  )}

                  {/* Error */}
                  {analyzeError && (
                    <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
                      <AlertCircle size={15} className="shrink-0" /> {analyzeError}
                    </div>
                  )}

                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className={clsx(
                      "mt-4 w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                      canAnalyze
                        ? "bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-md"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    )}
                  >
                    {analyzing ? (
                      <><Loader2 size={16} className="animate-spin" /> {t("analyzing")}</>
                    ) : (
                      <><PenLine size={16} /> {t("analyzeBtn")}</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Feedback view ── */
              <div className="space-y-4">
                {/* Score card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center gap-5 flex-wrap">
                    <ScoreCircle score={feedback.overall_score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                          {selectedTopic?.title ?? t("resultFallback")}
                        </h3>
                        <LevelBadge level={feedback.level_achieved} size="sm" />
                        {feedback.level_achieved !== selectedTopic?.level && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {t("targetLevel", { level: selectedTopic?.level ?? "" })}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-300 flex-wrap">
                        <span className="flex items-center gap-1"><BookOpen size={13} /> {t("wordsCount", { count: feedback.word_count })}</span>
                        <span className="flex items-center gap-1">
                          <AlertCircle size={13} className="text-orange-500" />
                          {t("correctionsCount", { count: feedback.corrections.length })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star size={13} className="text-yellow-500" />
                          {t("structureScore", { score: feedback.structure.score })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        {feedback.general_feedback}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                    {(["diff", "corrections", "vocabulary", "structure"] as FeedbackTab[]).map(tab => {
                      const labels: Record<FeedbackTab, string> = {
                        diff: t("tabDiff"),
                        corrections: t("tabCorrections", { count: feedback.corrections.length }),
                        vocabulary: t("tabVocabulary", { count: feedback.vocabulary_suggestions.length }),
                        structure: t("tabStructure"),
                      };
                      return (
                        <button key={tab}
                          onClick={() => setFeedbackTab(tab)}
                          className={clsx(
                            "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                            feedbackTab === tab
                              ? "border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20"
                              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {labels[tab]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-5">
                    {/* ── Diff View ── */}
                    {feedbackTab === "diff" && (
                      <div className="space-y-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                          {t("diffHint")}
                        </p>
                        <DiffView
                          originalText={userText}
                          correctedText={feedback.corrected_text}
                        />
                      </div>
                    )}

                    {/* ── Corrections ── */}
                    {feedbackTab === "corrections" && (
                      <div className="space-y-4">
                        {feedback.corrections.length === 0 ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                            <CheckCircle2 size={16} /> {t("noErrors")}
                          </div>
                        ) : Object.entries(groupedCorrections).map(([type, corrections]) => {
                          const colors = correctionColors[type] ?? correctionColors.grammar;
                          return (
                            <div key={type}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={clsx("text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide", colors.badge)}>
                                  {correctionTypeLabel(t, type)}
                                </span>
                                <span className="text-xs text-slate-400">({corrections.length})</span>
                              </div>
                              <div className="space-y-2">
                                {corrections.map((c, idx) => (
                                  <div key={idx} className={clsx("rounded-lg border p-3 text-sm", colors.bg)}>
                                    <div className="flex items-start gap-2 flex-wrap mb-1">
                                      <span className="line-through text-slate-500 dark:text-slate-400 font-mono text-xs bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded" dir="ltr" lang="de">
                                        {c.original}
                                      </span>
                                      <ArrowRight size={13} className="text-slate-400 mt-0.5 shrink-0 rtl:-scale-x-100" />
                                      <span className="font-medium font-mono text-xs bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-100" dir="ltr" lang="de">
                                        {c.corrected}
                                      </span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed" dir="auto">
                                      {c.explanation}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Vocabulary ── */}
                    {feedbackTab === "vocabulary" && (
                      <div className="space-y-3">
                        {feedback.vocabulary_suggestions.length === 0 ? (
                          <p className="text-sm text-slate-400">{t("noVocabSuggestions")}</p>
                        ) : feedback.vocabulary_suggestions.map((v, idx) => (
                          <div key={idx} className="rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/10 p-3">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 line-through" dir="ltr" lang="de">
                                {v.original}
                              </span>
                              <ArrowRight size={13} className="text-blue-400 shrink-0 rtl:-scale-x-100" />
                              <span className="font-mono text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold" dir="ltr" lang="de">
                                {v.suggestion}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed" dir="auto">
                              {v.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Structure ── */}
                    {feedbackTab === "structure" && (
                      <div className="space-y-4">
                        {/* Structure score */}
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                              {feedback.structure.score}
                            </div>
                            <div className="text-xs text-slate-400">/10</div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {feedback.structure.feedback}
                          </p>
                        </div>

                        {/* Exam feedback */}
                        {feedback.exam_feedback && (
                          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800/40">
                            <div className="flex items-center gap-2 mb-2">
                              <GraduationCap size={14} className="text-yellow-700 dark:text-yellow-300" />
                              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
                                {t("examFeedback", { exam: selectedTopic?.exam ?? "" })}
                              </span>
                            </div>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                              {feedback.exam_feedback}
                            </p>
                          </div>
                        )}

                        {/* Strengths */}
                        {feedback.strengths.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ThumbsUp size={14} className="text-green-600 dark:text-green-400" />
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("strengths")}</span>
                            </div>
                            <ul className="space-y-1">
                              {feedback.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                  <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Improvements */}
                        {feedback.improvements.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb size={14} className="text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("improvements")}</span>
                            </div>
                            <ul className="space-y-1">
                              {feedback.improvements.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                  <ArrowRight size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => { setFeedback(null); setUserText(""); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw size={15} /> {t("tryAgain")}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download size={15} /> {t("exportPdf")}
                  </button>
                  <button
                    onClick={() => { setSelectedTopic(null); setFeedback(null); setUserText(""); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-sm"
                  >
                    <PenLine size={15} /> {t("newTopic")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
