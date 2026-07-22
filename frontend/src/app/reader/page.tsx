"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { BookUpload } from "@/src/components/reader/BookUpload";
import { TextPanel, TextPanelHandle } from "@/src/components/reader/TextPanel";

const PDFViewer = dynamic(
  () => import("@/src/components/reader/PDFViewer").then((m) => ({ default: m.PDFViewer })),
  { ssr: false }
);
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { listBooks, deleteBook, getPageText, analyzePage, ocrRegionsPDF } from "@/src/lib/api";
import { useAppStore } from "@/src/lib/store";
import {
  BookOpen, ChevronLeft, ZoomIn, ZoomOut, Image, PanelRight, PanelRightClose,
  Trash2, Loader2, Sparkles, X, Plus,
} from "lucide-react";

const RTL_RE = /[֐-׿؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const isRtlLine = (s: string) => RTL_RE.test(s);

function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isBullet = /^\s*[•*-]\s/.test(line);
        const content = isBullet ? line.replace(/^\s*[•*-]\s*/, "") : line;
        const rtl = isRtlLine(content);
        const parts = content.split(/\*\*(.+?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j}>{p}</strong> : p
        );
        if (isBullet) {
          return (
            <div key={i} className={`flex gap-2.5 items-start ${rtl ? "flex-row-reverse text-right" : ""}`}>
              <span className="text-brand-400 font-bold mt-0.5 shrink-0 leading-5">•</span>
              <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed" dir={rtl ? "rtl" : "ltr"}>{rendered}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed" dir={rtl ? "rtl" : "ltr"}>{rendered}</p>
        );
      })}
    </div>
  );
}

function AnalysisLangToggle({
  langs,
  value,
  onChange,
}: {
  langs: { name: string; nativeName: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [{ name: "English", nativeName: "EN" }, ...langs.filter((l) => l.name !== "English").map((l) => ({ name: l.name, nativeName: l.nativeName || l.name }))];
  if (options.length <= 1) return null;
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.name}
          onClick={() => onChange(o.name)}
          className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
            value === o.name
              ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {o.nativeName.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

export default function ReaderPage() {
  const t = useTranslations("reader");
  const { activeBookId, setActiveBook, activePage, userLevel, translationLanguages } = useAppStore();
  const [books, setBooks] = useState<any[]>([]);
  const [activeBook, setActiveBookData] = useState<any>(null);
  const [fileUrlSuffix, setFileUrlSuffix] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [panelWidth, setPanelWidth] = useState(35); // % of the content area
  const [loading, setLoading] = useState(true);
  const [imgScale, setImgScale] = useState(1.0);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Image OCR text
  const [imageText, setImageText] = useState<string | null>(null);
  const [imageTextLoading, setImageTextLoading] = useState(false);
  const [pendingText, setPendingText] = useState("");

  // Page analysis
  const [pageAnalysis, setPageAnalysis] = useState<string | null>(null);
  const [pageAnalysisError, setPageAnalysisError] = useState<string | null>(null);
  const [pageAnalyzing, setPageAnalyzing] = useState(false);
  const [analysisLang, setAnalysisLang] = useState("English");

  const textPanelRef = useRef<TextPanelHandle>(null);

  useEffect(() => { loadBooks(); }, []);

  useEffect(() => {
    if (activeBookId && books.length) {
      const book = books.find((b) => b.id === activeBookId) || null;
      setActiveBookData(book);
      if (book?.file_type === "image") setShowPanel(true);
    }
  }, [activeBookId, books]);

  // Auto-OCR when an image book is opened — uses localStorage cache so it only runs once per book
  useEffect(() => {
    if (!activeBook || activeBook.file_type !== "image") return;
    setPendingText("");
    const cached = localStorage.getItem(`dp_ocr_${activeBook.id}`);
    if (cached !== null) {
      setImageText(cached);
      return;
    }
    setImageText(null);
    setImageTextLoading(true);
    getPageText(activeBook.id, 1)
      .then(({ text }) => {
        const t = text || "";
        setImageText(t);
        localStorage.setItem(`dp_ocr_${activeBook.id}`, t);
      })
      .catch(() => setImageText(""))
      .finally(() => setImageTextLoading(false));
  }, [activeBook?.id]);

  // Capture mouse-up selection in the OCR text panel
  const handleTextMouseUp = () => {
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length > 1) setPendingText(sel);
  };

  const handleAddSelected = () => {
    if (!pendingText) return;
    if (!showPanel) setShowPanel(true);
    textPanelRef.current?.addToQueue(pendingText);
    setPendingText("");
    window.getSelection()?.removeAllRanges();
  };

  const handleAnalyzePage = async () => {
    if (!activeBook) return;
    setPageAnalyzing(true);
    setPageAnalysis(null);
    setPageAnalysisError(null);
    const langName = analysisLang;
    const pageNum = activeBook.file_type === "image" ? 1 : activePage;
    try {
      const { analysis } = await analyzePage(activeBook.id, pageNum, langName);
      setPageAnalysis(analysis);
    } catch (e: any) {
      const msg = e?.message || "";
      setPageAnalysisError(
        msg.includes("API key") || msg.includes("key not set")
          ? t("errApiKeyMissing")
          : msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
          ? t("errQuota")
          : msg.includes("404")
          ? t("errBackendNotFound")
          : t("errAnalysisFailed", { msg: msg.slice(0, 120) })
      );
    } finally {
      setPageAnalyzing(false);
    }
  };

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await listBooks();
      setBooks(data);
      if (data.length && !activeBookId) setActiveBook(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  const handleResizeDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      const panelPx = rect.right - ev.clientX;
      const pct = Math.max(20, Math.min(60, (panelPx / rect.width) * 100));
      setPanelWidth(Math.round(pct));
    };

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleWordSelectedOnPDF = (text: string) => {
    if (!showPanel) setShowPanel(true);
    textPanelRef.current?.addToQueue(text);
  };

  const handleExtractRegions = async (
    regions: Array<{ x: number; y: number; w: number; h: number }>
  ) => {
    if (!activeBookId) return;
    const { texts } = await ocrRegionsPDF(activeBookId, activePage, regions);
    const nonEmpty = texts.filter((t) => t.trim());
    if (nonEmpty.length) {
      if (!showPanel) setShowPanel(true);
      nonEmpty.forEach((t) => textPanelRef.current?.addToQueue(t));
    }
  };

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!confirm(t("confirmDeleteBook"))) return;
    try {
      await deleteBook(bookId);
      localStorage.removeItem(`dp_ocr_${bookId}`);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      if (activeBookId === bookId) {
        const remaining = books.filter((b) => b.id !== bookId);
        if (remaining.length > 0) {
          setActiveBook(remaining[0].id);
          setActiveBookData(remaining[0]);
        } else {
          setActiveBook("");
          setActiveBookData(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploaded = (book: any) => {
    setBooks((prev) => [book, ...prev]);
    setActiveBook(book.id);
    setShowUpload(false);
  };

  const getBookUrl = (book: any) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const userId = process.env.NEXT_PUBLIC_USER_ID || "demo-user-001";
    return `${apiUrl}/books/${book.id}/file?user_id=${userId}${fileUrlSuffix}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Book sidebar */}
      <div className="w-56 border-e border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("books")}</p>
          <div className="space-y-1">
            {books.map((book) => (
              <div
                key={book.id}
                className={`group flex items-start gap-1 rounded-lg transition-colors ${
                  activeBookId === book.id ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <button
                  onClick={() => { setActiveBook(book.id); setActiveBookData(book); }}
                  className={`flex-1 min-w-0 text-start px-2.5 py-2 text-sm flex items-start gap-2 ${
                    activeBookId === book.id ? "text-brand-700" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {book.file_type === "image"
                    ? <Image size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                    : <BookOpen size={13} className="mt-0.5 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="truncate font-medium text-xs">{book.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <LevelBadge level={book.dominant_level || "A1"} />
                      {book.file_type === "image"
                        ? <span className="text-xs text-slate-400 dark:text-slate-500">{t("photo")}</span>
                        : <span className="text-xs text-slate-400 dark:text-slate-500">{book.total_pages}p</span>
                      }
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteBook(e, book.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 mt-1 me-1 rounded text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                  title={t("delete")}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full py-1.5 px-2 rounded-lg border border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 text-xs hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            {t("uploadBookOrPhoto")}
          </button>
        </div>
        <div className="mt-auto p-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t("level")}</p>
          <LevelBadge level={userLevel} size="md" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showUpload || books.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-lg">
              {books.length > 0 && (
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6"
                >
                  <ChevronLeft size={14} className="rtl:-scale-x-100" /> {t("backToReader")}
                </button>
              )}
              <BookUpload onUploaded={handleUploaded} />
            </div>
          </div>
        ) : activeBook ? (
          <div ref={contentRef} className="flex-1 flex overflow-hidden">
            {/* Left: viewer */}
            <div
              className="flex flex-col overflow-hidden min-w-0"
              style={{ width: showPanel ? `${100 - panelWidth}%` : "100%" }}
            >
              {activeBook.file_type === "image" ? (
                /* ── Image viewer ── */
                <div className="flex flex-col h-full">
                  {/* Image toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Image size={13} className="text-emerald-500" />
                      {t("photoLabel")}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setImgScale((s) => Math.max(0.3, +(s - 0.2).toFixed(1)))}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t("zoomOut")}
                      >
                        <ZoomOut size={16} />
                      </button>
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-center">
                        {Math.round(imgScale * 100)}%
                      </span>
                      <button
                        onClick={() => setImgScale((s) => Math.min(4.0, +(s + 0.2).toFixed(1)))}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t("zoomIn")}
                      >
                        <ZoomIn size={16} />
                      </button>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                      <AnalysisLangToggle
                        langs={translationLanguages}
                        value={analysisLang}
                        onChange={setAnalysisLang}
                      />
                      <button
                        onClick={handleAnalyzePage}
                        disabled={pageAnalyzing}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded font-medium disabled:opacity-50"
                        title={t("analyzePageTitle")}
                      >
                        {pageAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {t("analyze")}
                      </button>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                      <button
                        onClick={() => setShowPanel((p) => !p)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        {showPanel ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
                        {showPanel ? t("hide") : t("panel")}
                      </button>
                    </div>
                  </div>

                  {/* Image scroll area */}
                  <div className="flex-1 overflow-auto bg-slate-300 dark:bg-slate-700 flex justify-center p-4 min-h-0">
                    <div
                      className="shadow-xl"
                      style={{ width: `${Math.round(imgScale * 100)}%`, maxWidth: "none" }}
                    >
                      <img
                        src={getBookUrl(activeBook)}
                        alt={activeBook.title}
                        className="w-full h-auto block"
                      />
                    </div>
                  </div>

                  {/* Extracted text — selectable like PDF */}
                  <div className="border-t border-slate-200 dark:border-slate-700 flex flex-col shrink-0" style={{ maxHeight: "240px" }}>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700 shrink-0">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        {imageTextLoading ? t("extractingText") : t("extractedText")}
                      </span>
                      {imageTextLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                      {pendingText && (
                        <button
                          onClick={handleAddSelected}
                          className="flex items-center gap-1 px-2 py-0.5 bg-brand-600 text-white text-xs rounded-full font-medium hover:bg-brand-700 transition-colors"
                        >
                          <Plus size={10} />
                          {t("addToQueue")}
                        </button>
                      )}
                    </div>
                    <div
                      className="flex-1 overflow-y-auto px-3 py-2 text-sm text-slate-700 dark:text-slate-200 leading-relaxed select-text cursor-text"
                      dir="auto"
                      onMouseUp={handleTextMouseUp}
                    >
                      {imageText || (!imageTextLoading && (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">{t("noTextExtracted")}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── PDF viewer ── */
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                    <AnalysisLangToggle
                      langs={translationLanguages}
                      value={analysisLang}
                      onChange={setAnalysisLang}
                    />
                    <button
                      onClick={handleAnalyzePage}
                      disabled={pageAnalyzing}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded font-medium disabled:opacity-50"
                      title={t("analyzePageTitle")}
                    >
                      {pageAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {t("analyzePage")}
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <PDFViewer
                      fileUrl={getBookUrl(activeBook)}
                      totalPages={activeBook.total_pages}
                      bookId={activeBookId ?? undefined}
                      onWordSelected={handleWordSelectedOnPDF}
                      panelVisible={showPanel}
                      onTogglePanel={() => setShowPanel((p) => !p)}
                      onExtractRegions={handleExtractRegions}
                      onSaved={() => setFileUrlSuffix(`&_t=${Date.now()}`)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Resize handle + Text panel */}
            {showPanel && activeBookId && (
              <>
                <div
                  onMouseDown={handleResizeDragStart}
                  className="w-1 shrink-0 bg-slate-200 dark:bg-slate-700 hover:bg-brand-400 dark:hover:bg-brand-500 cursor-col-resize transition-colors"
                  title={t("dragToResize")}
                />
                <div
                  className="flex flex-col overflow-hidden min-w-0"
                  style={{ width: `${panelWidth}%` }}
                >
                  <TextPanel
                    ref={textPanelRef}
                    bookId={activeBookId}
                    pageNum={activePage}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
            {t("selectBook")}
          </div>
        )}
      </div>

      {/* Page summary modal */}
      {(pageAnalysis || pageAnalyzing || pageAnalysisError) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
            <div className="flex items-start gap-3 px-4 py-4">
              <Sparkles size={16} className="text-brand-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                {pageAnalyzing ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    {t("readingPage")}
                  </div>
                ) : pageAnalysisError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{pageAnalysisError}</p>
                ) : (
                  <AnalysisText text={pageAnalysis!} />
                )}
              </div>
              <button
                onClick={() => { setPageAnalysis(null); setPageAnalysisError(null); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
