"use client";

import { useState, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  batchAnalyzeWords, saveWord, readerChat, readPageContext, getPageContext, transcribeAudio, ttsSpeak,
} from "@/src/lib/api";
import { AnalysisTable } from "./AnalysisTable";
import { useAppStore } from "@/src/lib/store";
import {
  Sparkles, X, Loader2, MousePointer2, Plus,
  MessageSquare, BookOpen, Send, Mic, MicOff, ScanLine,
  PlusCircle, ChevronDown, Volume2, Trash2, Languages,
} from "lucide-react";

const RTL_RE = /[֐-׿؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

function isRtl(text: string): boolean {
  if (!RTL_RE.test(text)) return false;
  if (/[A-Za-z]/.test(text) && /[+=<>←→]/.test(text)) return false;
  return true;
}

function parseBoldBase(text: string, keyOffset = 0): React.ReactNode[] {
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = keyOffset;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      result.push(<strong key={k++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      const inner = match[2];
      const isLatin = !RTL_RE.test(inner);
      result.push(
        <code key={k++} dir={isLatin ? "ltr" : undefined}
          className="font-mono text-[0.875em] bg-slate-100 dark:bg-slate-700 px-1 rounded text-slate-700 dark:text-slate-200 not-italic">
          {inner}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function parseBold(text: string): React.ReactNode[] {
  const clean = text.replace(/\\([_*`[\]])/g, "$1");
  const DE_FLAG = "\u{1F1E9}\u{1F1EA}"; // 🇩🇪
  if (clean.includes(DE_FLAG)) {
    // Split at each 🇩🇪 — wrap German segments in LTR isolation so word
    // order is preserved even when the parent line is dir="rtl"
    const segs = clean.split(DE_FLAG);
    const result: React.ReactNode[] = [];
    result.push(...parseBoldBase(segs[0], 0));
    for (let i = 1; i < segs.length; i++) {
      result.push(
        <span key={`de${i}`} dir="ltr" style={{ unicodeBidi: "isolate", display: "inline-block" }}>
          {DE_FLAG}&nbsp;{parseBoldBase(segs[i], i * 300)}
        </span>
      );
    }
    return result;
  }
  return parseBoldBase(clean, 0);
}

function ExpandableBlock({ body }: { body: string }) {
  const t = useTranslations("textPanel");
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-brand-200 dark:border-brand-800/60 rounded-xl overflow-hidden mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-brand-50 dark:bg-brand-900/20 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors text-start gap-2"
      >
        <span>📖 {open ? t("hideExplanation") : t("fullExplanation")}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 py-2.5 border-t border-brand-200 dark:border-brand-800/60 space-y-1">
          {renderLines(body)}
        </div>
      )}
    </div>
  );
}

function renderLines(text: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const line of lines) {
    if (!line.trim()) { out.push(<div key={key++} className="h-1" />); continue; }

    const headMatch = line.match(/^#{1,3}\s+(.*)/);
    if (headMatch) {
      out.push(
        <p key={key++} className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mt-2 mb-0.5">
          {headMatch[1]}
        </p>
      );
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s+([\s\S]*)/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2].trim();
      const rtl = isRtl(content);
      out.push(
        <div key={key++} dir={rtl ? "rtl" : "ltr"} className="flex gap-2 items-start mt-0.5">
          <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {num}
          </span>
          <span className="flex-1 font-medium text-slate-800 dark:text-slate-100">{parseBold(content)}</span>
        </div>
      );
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([*•\-])\s+([\s\S]*)/);
    if (bulletMatch) {
      const nested = bulletMatch[1].length >= 2;
      const content = bulletMatch[3].trim();
      const rtl = isRtl(content);
      out.push(
        <div
          key={key++}
          dir={rtl ? "rtl" : "ltr"}
          style={nested ? { [rtl ? "paddingRight" : "paddingLeft"]: "1rem" } : undefined}
          className="flex gap-1.5 items-start"
        >
          <span className={`shrink-0 mt-0.5 leading-[1.4] ${nested ? "text-[10px] opacity-40" : "opacity-60"}`}>
            {nested ? "◦" : "•"}
          </span>
          <span className="flex-1">{parseBold(content)}</span>
        </div>
      );
      continue;
    }

    const rtl = isRtl(line.trim());
    out.push(
      <p key={key++} dir={rtl ? "rtl" : "ltr"} className="text-slate-800 dark:text-slate-200 leading-relaxed">
        {parseBold(line.trim())}
      </p>
    );
  }
  return <>{out}</>;
}

function renderMd(text: string): React.ReactNode {
  const sepIdx = text.indexOf("\n---MORE---");
  if (sepIdx !== -1) {
    const above = text.slice(0, sepIdx).trim();
    const below = text.slice(sepIdx + "\n---MORE---".length).trim();
    return (
      <div className="space-y-1">
        <div className="space-y-1">{renderLines(above)}</div>
        {below && <ExpandableBlock body={below} />}
      </div>
    );
  }

  const breakIdx = text.indexOf("\n\n");
  if (text.length > 320 && breakIdx !== -1 && breakIdx < text.length - 80) {
    const above = text.slice(0, breakIdx).trim();
    const below = text.slice(breakIdx).trim();
    return (
      <div className="space-y-1">
        <div className="space-y-1">{renderLines(above)}</div>
        <ExpandableBlock body={below} />
      </div>
    );
  }

  return <div className="space-y-1">{renderLines(text)}</div>;
}

function stripMd(text: string): string {
  return text
    .replace(/#{1,3}\s/g, "")
    .replace(/---MORE---/g, "")
    .replace(/\*\*?|__|~~|`/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export interface TextPanelHandle {
  addToQueue: (text: string) => void;
}

interface Props {
  bookId: string;
  pageNum: number;
}

const QUICK_PROMPT_KEYS_GENERAL = ["quickGeneral1", "quickGeneral2", "quickGeneral3"] as const;
const QUICK_PROMPT_KEYS_PAGE = ["quickPage1", "quickPage2", "quickPage3"] as const;

export const TextPanel = forwardRef<TextPanelHandle, Props>(function TextPanel(
  { bookId, pageNum },
  ref
) {
  const t = useTranslations("textPanel");
  const { userLevel, translationLanguages } = useAppStore();

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"words" | "chat">("words");

  // ── Words tab ─────────────────────────────────────────────────────────────
  const [selections, setSelections] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [manualInput, setManualInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    addToQueue: (text: string) => {
      setTab("words");
      setSelections((prev) =>
        prev.includes(text) || prev.length >= 25 ? prev : [...prev, text]
      );
    },
  }));

  const removeFromQueue = (i: number) =>
    setSelections((prev) => prev.filter((_, j) => j !== i));

  const handleManualAdd = () => {
    const word = manualInput.trim();
    if (!word) return;
    setSelections((prev) =>
      prev.includes(word) || prev.length >= 25 ? prev : [...prev, word]
    );
    setManualInput("");
    inputRef.current?.focus();
  };

  const handleAnalyze = async () => {
    if (!selections.length) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const data = await batchAnalyzeWords(selections, userLevel, translationLanguages);
      setResults((prev) => [...prev, ...data]);
      setSelections([]);
    } catch (e: any) {
      const raw = e?.message || "";
      setAnalyzeError(
        raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")
          ? t("errQuota")
          : t("errGeneric", { msg: raw.slice(0, 120) })
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveVocab = async (item: any) => {
    await saveWord(item, bookId, pageNum);
  };

  const handleDeleteResult = (i: number) =>
    setResults((prev) => prev.filter((_, j) => j !== i));

  const handleClearAll = () => {
    setResults([]);
    setSelections([]);
    setAnalyzeError("");
  };

  // ── Chat tab ──────────────────────────────────────────────────────────────
  const msgKey = `chat_msgs_${bookId}`;
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(msgKey) || "[]"); } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Context state
  const [contextPage, setContextPage] = useState<number | null>(null);
  const [contextChecking, setContextChecking] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const prevPageRef = useRef<number>(pageNum);
  const prevBookRef = useRef<string>(bookId);

  // TTS
  const [autoPlay, setAutoPlay] = useState(false);
  const [speakingContent, setSpeakingContent] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  // Language selector
  const [chatLang, setChatLang] = useState<{ code: string; name: string } | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node))
        setLangMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Voice input (Gemini audio via MediaRecorder)
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [hasMic, setHasMic] = useState(false);
  useEffect(() => {
    setHasMic(typeof navigator !== "undefined" && !!navigator?.mediaDevices?.getUserMedia);
    return () => { mediaRecorderRef.current?.stop(); };
  }, []);

  // Word selection from chat messages
  const [chatSelection, setChatSelection] = useState("");
  const [selectionAnchor, setSelectionAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dismiss = () => { setChatSelection(""); setSelectionAnchor(null); };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  // Persist messages
  useEffect(() => {
    sessionStorage.setItem(msgKey, JSON.stringify(chatMessages));
  }, [chatMessages, msgKey]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setSpeakingContent(null);
    setTtsLoading(null);
  };

  // ── Book switch → full reset ──────────────────────────────────────────────
  useEffect(() => {
    const prevBook = prevBookRef.current;
    if (prevBook === bookId) return;
    prevBookRef.current = bookId;
    prevPageRef.current = pageNum;

    setChatMessages([]);
    setChatError("");
    setContextPage(null);
    setContextLoading(false);
    stopAudio();

    // Check context for new book's first page
    setContextChecking(true);
    getPageContext(bookId, pageNum)
      .then(d => { if (d.ready) setContextPage(pageNum); })
      .catch(() => {})
      .finally(() => setContextChecking(false));
  }, [bookId]);

  // ── Page turn → system message + context check ───────────────────────────
  useEffect(() => {
    const prev = prevPageRef.current;
    if (prev === pageNum) return;
    prevPageRef.current = pageNum;

    // Cancel TTS
    stopAudio();

    // Inject system divider only if there's an active conversation
    setChatMessages(msgs => {
      const realMsgs = msgs.filter(m => m.role !== "system");
      if (realMsgs.length === 0) return msgs;
      return [...msgs, { role: "system" as const, content: `page:${pageNum}` }];
    });

    // Check if context exists for the new page
    setContextChecking(true);
    setContextPage(null);
    getPageContext(bookId, pageNum)
      .then(d => { if (d.ready) setContextPage(pageNum); })
      .catch(() => {})
      .finally(() => setContextChecking(false));
  }, [pageNum, bookId]);

  // Initial context check on mount
  useEffect(() => {
    setContextChecking(true);
    getPageContext(bookId, pageNum)
      .then(d => { if (d.ready) setContextPage(pageNum); })
      .catch(() => {})
      .finally(() => setContextChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadContext = async () => {
    if (contextLoading || contextPage === pageNum) return;
    setContextLoading(true);
    setChatError("");
    try {
      await readPageContext(bookId, pageNum);
      setContextPage(pageNum);
    } catch (e: any) {
      const raw = e?.message || "";
      setChatError(
        raw.includes("key not set") || raw.includes("API key")
          ? t("errApiKey")
          : t("errReadPage", { msg: raw.slice(0, 100) })
      );
    } finally {
      setContextLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setChatError("");
    stopAudio();
    sessionStorage.removeItem(msgKey);
  };

  // ── TTS (backend Gemini voice) ────────────────────────────────────────────
  const handleSpeak = async (text: string) => {
    if (speakingContent === text || ttsLoading === text) {
      stopAudio();
      return;
    }
    stopAudio();
    setTtsLoading(text);
    try {
      const lang = RTL_RE.test(text) ? "fa" : "de";
      const blob = await ttsSpeak(stripMd(text), lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setSpeakingContent(null); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeakingContent(null); audioRef.current = null; };
      setTtsLoading(null);
      setSpeakingContent(text);
      await audio.play();
    } catch {
      setTtsLoading(null);
      setSpeakingContent(null);
    }
  };

  // ── Voice input (Gemini audio) ────────────────────────────────────────────
  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(
        t => MediaRecorder.isTypeSupported(t)
      ) || "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          if (text) setChatInput(prev => prev ? `${prev} ${text}` : text);
        } catch (e: any) {
          const raw = e?.message || "";
          setChatError(raw ? t("errTranscription", { msg: raw.slice(0, 120) }) : t("errTranscriptionFailed"));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setChatError(t("errMicDenied"));
    }
  };

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendChatMessage = async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || chatLoading) return;
    if (recording) { mediaRecorderRef.current?.stop(); setRecording(false); }
    setChatInput("");

    const apiMessages = [
      ...chatMessages.filter(m => m.role !== "system"),
      { role: "user" as const, content: msg },
    ];
    setChatMessages(prev => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    setChatError("");

    try {
      const { reply } = await readerChat(bookId, pageNum, apiMessages, userLevel, chatLang?.name ?? "auto");
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
      if (autoPlayRef.current) {
        setTimeout(() => handleSpeak(reply), 150);
      }
    } catch (e: any) {
      setChatMessages(prev => prev.slice(0, -1));
      const raw = e?.message || "";
      setChatError(
        raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")
          ? t("errQuotaShort")
          : raw.includes("key not set") || raw.includes("API key")
          ? t("errApiKey")
          : t("errGeneric", { msg: raw.slice(0, 100) })
      );
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  // ── Chat text selection → Words ───────────────────────────────────────────
  const handleMessagesMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length > 0 && text.length <= 80) {
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const container = messagesRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        setChatSelection(text);
        setSelectionAnchor({
          x: rect.left + rect.width / 2 - cRect.left,
          y: rect.top - cRect.top + container.scrollTop - 4,
        });
      }
    } else {
      setChatSelection("");
      setSelectionAnchor(null);
    }
  };

  const addSelectionToWords = () => {
    if (!chatSelection) return;
    setSelections(prev =>
      prev.includes(chatSelection) || prev.length >= 25 ? prev : [...prev, chatSelection]
    );
    setTab("words");
    setChatSelection("");
    setSelectionAnchor(null);
    window.getSelection()?.removeAllRanges();
  };

  const quickPrompts = (contextPage === pageNum ? QUICK_PROMPT_KEYS_PAGE : QUICK_PROMPT_KEYS_GENERAL).map((k) => t(k));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full border-s border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setTab("words")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === "words"
              ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 -mb-px"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <BookOpen size={12} /> {t("words")}
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === "chat"
              ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 -mb-px"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquare size={12} /> {t("chat")}
        </button>
      </div>

      {/* ── Words tab ─────────────────────────────────────────────────────── */}
      {tab === "words" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t("wordAnalysis")}
            </span>
            {(results.length > 0 || selections.length > 0) && (
              <button
                onClick={handleClearAll}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                {t("clearAll")}
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <AnalysisTable results={results} onSaveVocab={handleSaveVocab} onDelete={handleDeleteResult} />
          ) : selections.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MousePointer2 size={28} className="text-slate-400" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t("highlightText")}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t("orTypeWord")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {selections.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 ps-2.5 pe-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-full font-medium border border-slate-300 dark:border-slate-600 shadow-sm"
                  >
                    {s}
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="w-4 h-4 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 space-y-2">
            {results.length > 0 && selections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selections.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 ps-2.5 pe-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-full font-medium border border-slate-300 dark:border-slate-600 shadow-sm"
                  >
                    {s}
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="w-4 h-4 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                placeholder={t("typeWordPlaceholder")}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-400 dark:focus:border-brand-500"
              />
              <button
                onClick={handleManualAdd}
                disabled={!manualInput.trim()}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {selections.length > 0 && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {analyzing ? (
                  <><Loader2 size={15} className="animate-spin" />{t("analyzing")}</>
                ) : (
                  <><Sparkles size={15} />{t("analyzeCount", { count: selections.length })}</>
                )}
              </button>
            )}
            {analyzeError && <p className="text-xs text-red-500">{analyzeError}</p>}
          </div>
        </div>
      )}

      {/* ── Chat tab ──────────────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* Chat header: context chip + auto-play + clear */}
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {/* Context chip */}
            <button
              onClick={handleLoadContext}
              disabled={contextLoading || contextPage === pageNum}
              title={contextPage === pageNum ? t("pageContextLoadedTitle", { page: pageNum }) : t("loadPageContextTitle", { page: pageNum })}
              className={`flex-1 min-w-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                contextPage === pageNum
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 cursor-default"
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
              }`}
            >
              {contextLoading ? (
                <><Loader2 size={11} className="animate-spin shrink-0" /><span className="truncate">{t("readingPage")}</span></>
              ) : contextChecking ? (
                <Loader2 size={11} className="animate-spin shrink-0 text-slate-300" />
              ) : contextPage === pageNum ? (
                <><span className="text-emerald-500 shrink-0">●</span><span className="truncate">{t("pageLoaded", { page: pageNum })}</span></>
              ) : (
                <><ScanLine size={11} className="shrink-0" /><span className="truncate">{t("loadPage", { page: pageNum })}</span></>
              )}
            </button>

            {/* Language selector */}
            <div ref={langMenuRef} className="relative shrink-0">
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                title={t("chooseReplyLanguage")}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                  chatLang
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <Languages size={11} />
                <span>{chatLang ? chatLang.code.toUpperCase() : t("auto")}</span>
              </button>
              {langMenuOpen && (() => {
                const opts = [
                  { code: "auto", name: "Auto-detect", label: t("autoDetect") },
                  { code: "en", name: "English", label: t("english") },
                  { code: "de", name: "German", label: t("german") },
                  ...translationLanguages
                    .filter(l => l.code !== "en" && l.code !== "de")
                    .map(l => ({ code: l.code, name: l.name, label: l.name })),
                ];
                return (
                  <div className="absolute top-full mt-1 end-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[130px]">
                    {opts.map(l => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setChatLang(l.code === "auto" ? null : { code: l.code, name: l.name });
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-start px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${
                          (l.code === "auto" ? !chatLang : chatLang?.code === l.code)
                            ? "text-brand-600 dark:text-brand-400 font-semibold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Auto-play toggle */}
            <button
              onClick={() => setAutoPlay(a => !a)}
              title={autoPlay ? t("autoPlayOnTitle") : t("autoPlayOffTitle")}
              className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                autoPlay
                  ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <Volume2 size={11} />
              <span>{autoPlay ? t("autoOn") : t("auto")}</span>
            </button>

            {/* Clear chat */}
            {chatMessages.filter(m => m.role !== "system").length > 0 && (
              <button
                onClick={handleClearChat}
                title={t("clearChat")}
                className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Message list */}
          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 relative"
            onMouseUp={handleMessagesMouseUp}
          >
            {selectionAnchor && chatSelection && (
              <button
                onMouseDown={(e) => { e.preventDefault(); addSelectionToWords(); }}
                style={{ left: selectionAnchor.x, top: selectionAnchor.y }}
                className="absolute z-20 -translate-x-1/2 -translate-y-full flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-semibold shadow-lg hover:bg-brand-700 transition-colors whitespace-nowrap"
              >
                <PlusCircle size={11} /> {t("addToWords")}
              </button>
            )}

            {/* Empty state */}
            {chatMessages.filter(m => m.role !== "system").length === 0 && !chatLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center select-none py-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                  <MessageSquare size={24} className="text-brand-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {t("teacherReady")}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {contextPage === pageNum
                      ? t("pageLoadedHint")
                      : t("askAnythingHint")}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChatMessage(q)}
                      className="w-full text-start px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {chatMessages.map((msg, i) => {
              /* System divider (page turn) */
              if (msg.role === "system") {
                const targetPage = parseInt(msg.content.replace("page:", ""), 10);
                return (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        📄 {t("pageDivider", { page: targetPage })}
                      </span>
                      {contextPage !== targetPage && (
                        <button
                          onClick={handleLoadContext}
                          disabled={contextLoading || pageNum !== targetPage}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-40"
                        >
                          {t("load")}
                        </button>
                      )}
                    </div>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                );
              }

              const rtl = RTL_RE.test(msg.content);
              const isUser = msg.role === "user";
              const isSpeaking = speakingContent === msg.content;
              const isLoadingTts = ttsLoading === msg.content;

              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} gap-1.5`}>
                  {/* Speaker button (assistant only) */}
                  {!isUser && (
                    <button
                      onClick={() => handleSpeak(msg.content)}
                      title={isSpeaking ? t("stop") : isLoadingTts ? t("generating") : t("listen")}
                      className={`shrink-0 mt-1 p-1 rounded-lg transition-colors self-start ${
                        isSpeaking || isLoadingTts
                          ? "text-brand-500 bg-brand-50 dark:bg-brand-900/20"
                          : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
                      }`}
                    >
                      {isLoadingTts
                        ? <Loader2 size={11} className="animate-spin" />
                        : isSpeaking
                        ? <Volume2 size={11} className="animate-pulse" />
                        : <Volume2 size={11} />}
                    </button>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-brand-600 text-white rounded-ee-sm whitespace-pre-wrap"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-es-sm"
                    }`}
                    dir={rtl ? "rtl" : "ltr"}
                  >
                    {!isUser ? renderMd(msg.content) : msg.content}
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex justify-start gap-1.5">
                <div className="w-6" /> {/* spacer aligning with speaker button */}
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl rounded-es-sm">
                  <Loader2 size={13} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            {chatError && (
              <p className="text-xs text-red-500 text-center px-2">{chatError}</p>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                }}
                placeholder={
                  transcribing ? t("transcribing")
                  : recording ? t("recordingTapToStop")
                  : t("askTeacherPlaceholder")
                }
                disabled={chatLoading || transcribing}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-400 dark:focus:border-brand-500 disabled:opacity-50"
              />
              {hasMic && (
                <button
                  onClick={toggleRecording}
                  disabled={chatLoading || transcribing}
                  title={recording ? t("stopRecording") : t("voiceInput")}
                  className={`shrink-0 p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                    recording
                      ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-500 animate-pulse"
                      : transcribing
                      ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-500"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-400"
                  }`}
                >
                  {recording ? <MicOff size={13} /> : transcribing ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
                </button>
              )}
              <button
                onClick={() => sendChatMessage()}
                disabled={!chatInput.trim() || chatLoading || transcribing}
                className="shrink-0 p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
