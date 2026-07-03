"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft, ChevronRight, Plus,
  PanelRight, PanelRightClose, Pencil, Scan, Loader2, X,
  ZoomIn, ZoomOut, Save, Pen,
} from "lucide-react";
import { useAppStore } from "@/src/lib/store";
import { listAnnotations, listAllAnnotations, createAnnotation, deleteAnnotation, deleteAllBookAnnotations, overwriteBookFile } from "@/src/lib/api";
import { AnnotationLayer, AnnotationItem, MarkType } from "./AnnotationLayer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MARK_SYMBOLS: Record<MarkType, string> = {
  text: "T", x: "✕", dot: "●", check: "✓", circle: "○", highlight: "▬",
};
const MARK_LABELS: Record<MarkType, string> = {
  text: "Text note", x: "Cross", dot: "Dot", check: "Check", circle: "Circle", highlight: "Highlight",
};
const TEXT_COLORS  = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#475569"];
const HIGHLIGHT_COLORS = ["#FEF08A", "#86EFAC", "#93C5FD", "#FDA4AF", "#FDE68A"];

function hexToRgbFrac(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

interface Region {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  fileUrl: string;
  totalPages: number;
  bookId?: string;
  onWordSelected?: (text: string) => void;
  panelVisible?: boolean;
  onTogglePanel?: () => void;
  onExtractRegions?: (regions: Array<{ x: number; y: number; w: number; h: number }>) => Promise<void>;
  onSaved?: () => void;
}

interface FloatingBtn {
  text: string;
  x: number;
  y: number;
}

function cleanSelection(raw: string): string {
  return raw
    .replace(/­/g, "")
    .replace(/-[ \t]*\n[ \t]*/g, "")
    .replace(/\n/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function PDFViewer({
  fileUrl,
  totalPages,
  bookId,
  onWordSelected,
  panelVisible,
  onTogglePanel,
  onExtractRegions,
  onSaved,
}: Props) {
  const { activePage, setActivePage } = useAppStore();
  const [scale, setScale] = useState(1.2);
  const [numPages, setNumPages] = useState(totalPages);
  const [pageInput, setPageInput] = useState(String(activePage));
  const [floatingBtn, setFloatingBtn] = useState<FloatingBtn | null>(null);
  const [toast, setToast] = useState<string>("");

  // Draw mode
  const [drawMode, setDrawMode] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentRect, setCurrentRect] = useState<Omit<Region, "id"> | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Annotation mode
  const [annotateMode, setAnnotateMode] = useState(false);
  const [markType, setMarkType] = useState<MarkType>("x");
  const [markColor, setMarkColor] = useState(TEXT_COLORS[0]);
  const [markFontSize, setMarkFontSize] = useState(12);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number } | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const highlightDragStart = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // ── Load annotations when page or book changes ─────────────────────────────

  useEffect(() => {
    if (!bookId) return;
    listAnnotations(bookId, activePage)
      .then(setAnnotations)
      .catch(() => setAnnotations([]));
  }, [bookId, activePage]);

  // ── Text selection ─────────────────────────────────────────────────────────

  const readSelection = useCallback(() => {
    if (drawMode || annotateMode) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setFloatingBtn(null);
      return;
    }
    const cleaned = cleanSelection(sel.toString());
    if (cleaned.length < 2) { setFloatingBtn(null); return; }
    try {
      const range = sel.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        setFloatingBtn(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setFloatingBtn({
        text: cleaned,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top),
      });
    } catch {
      setFloatingBtn(null);
    }
  }, [drawMode, annotateMode]);

  useEffect(() => {
    const onMouseUp = () => readSelection();
    const onSelChange = () => {
      if (drawMode || annotateMode) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setFloatingBtn(null);
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [readSelection, drawMode, annotateMode]);

  // Clear state on page change
  useEffect(() => {
    setFloatingBtn(null);
    setRegions([]);
    setCurrentRect(null);
    setDrawMode(false);
    setPendingAnnotation(null);
    setCurrentHighlight(null);
    highlightDragStart.current = null;
    dragStart.current = null;
    setPageInput(String(activePage));
  }, [activePage]);

  const commitPage = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) setActivePage(Math.max(1, Math.min(numPages, n)));
    else setPageInput(String(activePage));
  };

  const handleAdd = () => {
    if (!floatingBtn || !onWordSelected) return;
    onWordSelected(floatingBtn.text);
    setFloatingBtn(null);
    window.getSelection()?.removeAllRanges();
    clearTimeout(toastTimer.current);
    const preview = floatingBtn.text.length > 20 ? floatingBtn.text.slice(0, 20) + "…" : floatingBtn.text;
    setToast(`Added "${preview}"`);
    toastTimer.current = setTimeout(() => setToast(""), 2000);
  };

  // ── Coordinate helper ──────────────────────────────────────────────────────

  const toFrac = (e: React.MouseEvent): { x: number; y: number } => {
    if (!pageWrapperRef.current) return { x: 0, y: 0 };
    const rect = pageWrapperRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  // ── Draw mode handlers ─────────────────────────────────────────────────────

  const handleDrawStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = toFrac(e);
    dragStart.current = pos;
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleDrawMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const pos = toFrac(e);
    const { x: sx, y: sy } = dragStart.current;
    setCurrentRect({
      x: Math.min(sx, pos.x),
      y: Math.min(sy, pos.y),
      w: Math.abs(pos.x - sx),
      h: Math.abs(pos.y - sy),
    });
  };

  const handleDrawEnd = (e: React.MouseEvent) => {
    if (!dragStart.current || !currentRect) { dragStart.current = null; return; }
    if (currentRect.w > 0.02 && currentRect.h > 0.015) {
      setRegions((prev) => [
        ...prev,
        { ...currentRect, id: Math.random().toString(36).slice(2) },
      ]);
    }
    dragStart.current = null;
    setCurrentRect(null);
  };

  const handleDrawCancel = () => {
    if (dragStart.current) {
      dragStart.current = null;
      setCurrentRect(null);
    }
  };

  const removeRegion = (id: string) =>
    setRegions((prev) => prev.filter((r) => r.id !== id));

  const handleExtract = async () => {
    if (!onExtractRegions || regions.length === 0) return;
    setExtracting(true);
    try {
      await onExtractRegions(regions.map(({ x, y, w, h }) => ({ x, y, w, h })));
      setRegions([]);
      setDrawMode(false);
    } catch {
      // parent handles errors
    } finally {
      setExtracting(false);
    }
  };

  // ── Annotation handlers ────────────────────────────────────────────────────

  const handleAnnotateClick = async (e: React.MouseEvent) => {
    if (!bookId || markType === "highlight") return;
    const pos = toFrac(e);
    if (markType === "text") {
      if (pendingAnnotation) return;
      setPendingAnnotation(pos);
    } else {
      try {
        const saved = await createAnnotation({
          book_id: bookId,
          page_num: activePage,
          x: pos.x,
          y: pos.y,
          content: "",
          color: markColor,
          mark_type: markType,
        });
        setAnnotations((prev) => [...prev, saved]);
      } catch { /* ignore */ }
    }
  };

  const handleSaveAnnotation = async (content: string) => {
    if (!bookId || !pendingAnnotation) return;
    setPendingAnnotation(null);
    try {
      const saved = await createAnnotation({
        book_id: bookId,
        page_num: activePage,
        x: pendingAnnotation.x,
        y: pendingAnnotation.y,
        content,
        color: markColor,
        mark_type: "text",
        font_size: markFontSize,
      });
      setAnnotations((prev) => [...prev, saved]);
    } catch { /* ignore */ }
  };

  const handleDeleteAnnotation = async (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    try { await deleteAnnotation(id); } catch { /* ignore */ }
  };

  const handleUpdateAnnotation = async (id: string, content: string) => {
    if (!bookId) return;
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, content } : a));
    try {
      await deleteAnnotation(id);
      const saved = await createAnnotation({
        book_id: bookId,
        page_num: activePage,
        x: ann.x,
        y: ann.y,
        content,
        color: ann.color,
        mark_type: "text",
        font_size: ann.font_size,
      });
      setAnnotations((prev) => prev.map((a) => a.id === id ? saved : a));
    } catch { /* keep optimistic update */ }
  };

  // ── PDF save (bake marks → overwrite file on server) ──────────────────────

  const handleSavePDF = async () => {
    if (!bookId) return;
    setSaving(true);
    try {
      const [{ PDFDocument, rgb, StandardFonts }, pdfRes, allAnns] = await Promise.all([
        import("pdf-lib"),
        fetch(fileUrl),
        listAllAnnotations(bookId),
      ]);

      if (!allAnns.length) {
        setSaving(false);
        return;
      }

      const bytes = await pdfRes.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      for (const ann of allAnns) {
        const page = pages[ann.page_num - 1];
        if (!page) continue;
        const { width, height } = page.getSize();
        const px = ann.x * width;
        const py = height - ann.y * height;
        const type: MarkType = (ann.mark_type as MarkType) || "text";

        const [cr, cg, cb] = hexToRgbFrac(ann.color || "#EF4444");

        if (type === "text") {
          const lines: string[] = ann.content.split("\n");
          const fontSize = ann.font_size || 12;
          const lineH = fontSize * 1.4;
          lines.forEach((line: string, li: number) => {
            page.drawText(line, { x: px, y: py - li * lineH, size: fontSize, font, color: rgb(cr, cg, cb) });
          });
        } else if (type === "highlight") {
          const w = (ann.ann_width || 0) * width;
          const h = (ann.ann_height || 0) * height;
          page.drawRectangle({ x: px, y: py - h, width: w, height: h, color: rgb(cr, cg, cb), opacity: 0.3 });
        } else if (type === "x") {
          const s = 7;
          page.drawLine({ start: { x: px - s, y: py - s }, end: { x: px + s, y: py + s }, thickness: 2, color: rgb(cr, cg, cb) });
          page.drawLine({ start: { x: px + s, y: py - s }, end: { x: px - s, y: py + s }, thickness: 2, color: rgb(cr, cg, cb) });
        } else if (type === "dot") {
          page.drawCircle({ x: px, y: py, size: 4, color: rgb(cr, cg, cb) });
        } else if (type === "check") {
          page.drawLine({ start: { x: px - 6, y: py }, end: { x: px - 1, y: py - 5 }, thickness: 2, color: rgb(cr, cg, cb) });
          page.drawLine({ start: { x: px - 1, y: py - 5 }, end: { x: px + 8, y: py + 7 }, thickness: 2, color: rgb(cr, cg, cb) });
        } else if (type === "circle") {
          page.drawEllipse({ x: px, y: py, xScale: 14, yScale: 9, borderColor: rgb(cr, cg, cb), borderWidth: 1.5, color: rgb(1, 1, 1), opacity: 0 });
        }
      }

      const modified = await pdfDoc.save();
      await overwriteBookFile(bookId, modified as unknown as Uint8Array);
      await deleteAllBookAnnotations(bookId);
      setAnnotations([]);
      setAnnotateMode(false);
      setPendingAnnotation(null);
      onSaved?.();

      clearTimeout(toastTimer.current);
      setToast("Saved ✓");
      toastTimer.current = setTimeout(() => setToast(""), 2500);
    } catch (err) {
      console.error("Save failed", err);
      clearTimeout(toastTimer.current);
      setToast("Save failed ✗");
      toastTimer.current = setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full relative">
      {/* Floating "+ Add" button for text selection */}
      {floatingBtn && onWordSelected && !drawMode && !annotateMode && (
        <div
          className="fixed z-[60] pointer-events-auto"
          style={{
            left: floatingBtn.x,
            top: floatingBtn.y - 44,
            transform: "translateX(-50%)",
          }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all whitespace-nowrap"
          >
            <Plus size={11} />
            Add &ldquo;{floatingBtn.text.length > 18 ? floatingBtn.text.slice(0, 18) + "…" : floatingBtn.text}&rdquo;
          </button>
          <div className="flex justify-center -mt-px">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-emerald-600" />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
          ✓ {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 gap-2 flex-wrap">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePage(Math.max(1, activePage - 1))}
            disabled={activePage <= 1}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPage}
              onKeyDown={(e) => { if (e.key === "Enter") { commitPage(); (e.target as HTMLInputElement).blur(); } }}
              className="w-12 text-center bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 focus:border-brand-500 focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-slate-400 dark:text-slate-500">/ {numPages}</span>
          </div>
          <button
            onClick={() => setActivePage(Math.min(numPages, activePage + 1))}
            disabled={activePage >= numPages}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Zoom */}
          <button
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            title="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={() => setScale(1.2)}
            className="text-xs text-slate-500 dark:text-slate-400 w-10 text-center hover:text-slate-800 dark:hover:text-slate-200 tabular-nums"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => setScale((s) => Math.min(3.0, +(s + 0.25).toFixed(2)))}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            title="Zoom in"
          >
            <ZoomIn size={15} />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Mark toolbar */}
          {bookId && (
            <>
              <button
                onClick={() => {
                  setAnnotateMode((a) => !a);
                  setDrawMode(false);
                  setPendingAnnotation(null);
                  setCurrentHighlight(null);
                  highlightDragStart.current = null;
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  annotateMode
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Mark mode"
              >
                <Pen size={13} />
                {annotateMode ? "Marking" : "Mark"}
              </button>

              <button
                onClick={handleSavePDF}
                disabled={saving || annotations.length === 0}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                title="Bake marks into PDF and save to disk"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? "Saving…" : "Save"}
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            </>
          )}

          {/* Panel toggle */}
          {onTogglePanel && (
            <>
              <button
                onClick={onTogglePanel}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                title={panelVisible ? "Hide text panel" : "Show text panel"}
              >
                {panelVisible ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
                {panelVisible ? "Hide" : "Panel"}
              </button>
            </>
          )}

          {/* Draw mode */}
          {onExtractRegions && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button
                onClick={() => {
                  setDrawMode((d) => !d);
                  setAnnotateMode(false);
                  setCurrentRect(null);
                  setPendingAnnotation(null);
                  dragStart.current = null;
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  drawMode
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Draw regions to OCR"
              >
                <Pencil size={13} />
                {drawMode ? "Drawing…" : "Draw"}
              </button>

              {regions.length > 0 && (
                <>
                  <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-brand-600 text-white rounded font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {extracting ? <Loader2 size={12} className="animate-spin" /> : <Scan size={12} />}
                    {extracting ? "Extracting…" : `Extract ${regions.length}`}
                  </button>
                  {!extracting && (
                    <button
                      onClick={() => setRegions([])}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating mark toolbar */}
      {annotateMode && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 select-none">
          {/* Type buttons */}
          <div className="flex items-center gap-0.5">
            {(["text", "highlight", "x", "dot", "check", "circle"] as MarkType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  const wasHL = markType === "highlight";
                  const isHL  = t === "highlight";
                  setMarkType(t);
                  if (!wasHL && isHL)  setMarkColor(HIGHLIGHT_COLORS[0]);
                  if (wasHL  && !isHL) setMarkColor(TEXT_COLORS[0]);
                }}
                title={MARK_LABELS[t]}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                  markType === t
                    ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {MARK_SYMBOLS[t]}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 shrink-0" />

          {/* Color swatches */}
          <div className="flex items-center gap-1">
            {(markType === "highlight" ? HIGHLIGHT_COLORS : TEXT_COLORS).map((c) => (
              <button
                key={c}
                onClick={() => setMarkColor(c)}
                title={c}
                className="w-4 h-4 rounded-full transition-transform hover:scale-110 shrink-0"
                style={{
                  backgroundColor: c,
                  outline: markColor === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                  border: "1px solid rgba(0,0,0,0.12)",
                }}
              />
            ))}
          </div>

          {/* Size (text only) */}
          {markType === "text" && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 shrink-0" />
              <div className="flex items-center gap-0.5">
                {([{ l: "S", s: 9 }, { l: "M", s: 12 }, { l: "L", s: 16 }] as const).map(({ l, s }) => (
                  <button
                    key={l}
                    onClick={() => setMarkFontSize(s)}
                    className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-colors ${
                      markFontSize === s
                        ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 shrink-0" />

          {/* Exit mark mode */}
          <button
            onClick={() => { setAnnotateMode(false); setPendingAnnotation(null); setCurrentHighlight(null); }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Exit mark mode"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* PDF canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-300 dark:bg-slate-700 flex justify-center p-4"
      >
        <div ref={pageWrapperRef} className="relative shadow-xl self-start" style={{ lineHeight: 0 }}>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="text-slate-500 mt-20 px-8">Loading PDF…</div>}
            error={<div className="text-red-500 mt-20 px-8">Failed to load PDF.</div>}
          >
            <Page
              pageNumber={activePage}
              scale={scale}
              canvasRef={canvasRef}
              renderTextLayer={true}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Annotation layer */}
          <AnnotationLayer
            annotations={annotations}
            pending={pendingAnnotation}
            onSave={handleSaveAnnotation}
            onCancel={() => setPendingAnnotation(null)}
            onDelete={handleDeleteAnnotation}
            onUpdate={handleUpdateAnnotation}
            pendingColor={markColor}
            pendingFontSize={markFontSize}
          />

          {/* Highlight drag preview */}
          {currentHighlight && (
            <div
              className="absolute pointer-events-none z-[18]"
              style={{
                left: `${currentHighlight.x * 100}%`,
                top: `${currentHighlight.y * 100}%`,
                width: `${currentHighlight.w * 100}%`,
                height: `${currentHighlight.h * 100}%`,
                backgroundColor: markColor + "40",
                borderBottom: `2px solid ${markColor}`,
              }}
            />
          )}

          {/* Saved draw regions */}
          {regions.map((r, i) => (
            <div
              key={r.id}
              className="absolute border-2 border-amber-500 pointer-events-none"
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                backgroundColor: "rgba(251,191,36,0.18)",
              }}
            >
              {drawMode && (
                <div className="absolute -top-5 left-0 flex items-center gap-0.5 pointer-events-auto">
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1 rounded-sm leading-4">
                    {i + 1}
                  </span>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeRegion(r.id); }}
                    className="bg-white border border-amber-300 text-amber-600 hover:text-red-500 text-[10px] leading-4 px-1 rounded-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Draw capture overlay */}
          {drawMode && (
            <div
              className="absolute inset-0 z-20 select-none"
              style={{ cursor: "crosshair" }}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawCancel}
            >
              {currentRect && currentRect.w > 0 && currentRect.h > 0 && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 pointer-events-none"
                  style={{
                    left: `${currentRect.x * 100}%`,
                    top: `${currentRect.y * 100}%`,
                    width: `${currentRect.w * 100}%`,
                    height: `${currentRect.h * 100}%`,
                    backgroundColor: "rgba(59,130,246,0.1)",
                  }}
                />
              )}
            </div>
          )}

          {/* Annotation capture overlay */}
          {annotateMode && !pendingAnnotation && (
            <div
              className="absolute inset-0 z-20 select-none"
              style={{ cursor: markType === "highlight" ? "crosshair" : "crosshair" }}
              onMouseDown={(e) => {
                if (markType !== "highlight") return;
                e.preventDefault();
                hasDragged.current = false;
                highlightDragStart.current = toFrac(e);
              }}
              onMouseMove={(e) => {
                if (markType !== "highlight" || !highlightDragStart.current) return;
                hasDragged.current = true;
                const pos = toFrac(e);
                const { x: sx, y: sy } = highlightDragStart.current;
                setCurrentHighlight({
                  x: Math.min(sx, pos.x), y: Math.min(sy, pos.y),
                  w: Math.abs(pos.x - sx), h: Math.abs(pos.y - sy),
                });
              }}
              onMouseLeave={() => {
                if (markType === "highlight") {
                  highlightDragStart.current = null;
                  setCurrentHighlight(null);
                }
              }}
              onMouseUp={async (e) => {
                if (markType !== "highlight") return;
                const hl = currentHighlight;
                highlightDragStart.current = null;
                setCurrentHighlight(null);
                if (hl && hl.w > 0.01 && hl.h > 0.005 && bookId) {
                  try {
                    const saved = await createAnnotation({
                      book_id: bookId, page_num: activePage,
                      x: hl.x, y: hl.y, content: "",
                      color: markColor, mark_type: "highlight",
                      ann_width: hl.w, ann_height: hl.h,
                    });
                    setAnnotations((prev) => [...prev, saved]);
                  } catch { /* ignore */ }
                }
              }}
              onClick={(e) => {
                if (markType === "highlight") return;
                handleAnnotateClick(e);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
