"use client";

import { useState, useRef, useEffect } from "react";
import { X, Pencil } from "lucide-react";

export type MarkType = "text" | "x" | "dot" | "check" | "circle" | "highlight";

export interface AnnotationItem {
  id: string;
  x: number;
  y: number;
  ann_width?: number;
  ann_height?: number;
  content: string;
  color: string;
  mark_type: MarkType;
  font_size?: number;
}

const MARK_SYMBOL: Record<string, string> = {
  x: "✕", dot: "●", check: "✓", circle: "○",
};

interface Props {
  annotations: AnnotationItem[];
  pending: { x: number; y: number } | null;
  onSave: (content: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  pendingColor?: string;
  pendingFontSize?: number;
}

export function AnnotationLayer({
  annotations, pending, onSave, onCancel, onDelete, onUpdate,
  pendingColor = "#EF4444", pendingFontSize = 12,
}: Props) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    if (pending) {
      setDraft("");
      setTimeout(() => textareaRef.current?.focus(), 40);
    }
  }, [pending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim()) onSave(draft.trim());
      else onCancel();
    }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const handleBlur = () => {
    if (draft.trim()) onSave(draft.trim());
    else onCancel();
  };

  return (
    <>
      {annotations.map((ann) => {
        const type: MarkType = (ann.mark_type as MarkType) || "text";

        /* ── Highlight ── */
        if (type === "highlight") {
          return (
            <div
              key={ann.id}
              className="absolute z-[15] group"
              style={{
                left: `${ann.x * 100}%`,
                top: `${ann.y * 100}%`,
                width: `${(ann.ann_width ?? 0) * 100}%`,
                height: `${(ann.ann_height ?? 0) * 100}%`,
                backgroundColor: ann.color + "4D",
                borderBottom: `2px solid ${ann.color}90`,
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-slate-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
              >
                <X size={8} />
              </button>
            </div>
          );
        }

        /* ── Text note ── */
        if (type === "text") {
          const sz = ann.font_size || 12;
          if (editingId === ann.id) {
            return (
              <div
                key={ann.id}
                className="absolute z-30"
                style={{ left: `${ann.x * 100}%`, top: `${ann.y * 100}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-lg shadow-xl bg-white dark:bg-slate-800 overflow-hidden">
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editDraft.trim()) onUpdate(ann.id, editDraft.trim());
                        else onDelete(ann.id);
                        setEditingId(null);
                      }
                      if (e.key === "Escape") { e.preventDefault(); setEditingId(null); }
                    }}
                    onBlur={() => {
                      if (editDraft.trim()) onUpdate(ann.id, editDraft.trim());
                      else onDelete(ann.id);
                      setEditingId(null);
                    }}
                    rows={2}
                    className="w-44 px-2 py-0 bg-transparent resize-none focus:outline-none"
                    style={{ fontSize: `${sz}px`, color: ann.color, lineHeight: "1.4" }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Enter to save · Esc to cancel</p>
              </div>
            );
          }
          return (
            <div
              key={ann.id}
              className="absolute z-[25] group"
              style={{ left: `${ann.x * 100}%`, top: `${ann.y * 100}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative" style={{ maxWidth: "200px" }}>
                <span
                  className="whitespace-pre-wrap font-medium leading-tight select-none block"
                  style={{ color: ann.color, fontSize: `${sz}px`, userSelect: "none" }}
                >
                  {ann.content}
                </span>
              </div>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); setEditingId(ann.id); setEditDraft(ann.content); }}
                className="absolute -top-2 -left-2 w-4 h-4 bg-slate-700 hover:bg-brand-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                title="Edit"
              >
                <Pencil size={7} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-slate-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                title="Delete"
              >
                <X size={8} />
              </button>
            </div>
          );
        }

        /* ── Symbol marks: ✕ ● ✓ ○ ── */
        return (
          <div
            key={ann.id}
            className="absolute z-[25] group"
            style={{
              left: `${ann.x * 100}%`,
              top: `${ann.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <span
                className="select-none leading-none"
                style={{
                  color: ann.color,
                  fontSize: type === "circle" ? "22px" : "18px",
                  fontWeight: type === "dot" ? 400 : 700,
                  userSelect: "none",
                }}
              >
                {MARK_SYMBOL[type] ?? "●"}
              </span>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-slate-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
              >
                <X size={8} />
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Pending text input popup ── */}
      {pending && (
        <div
          className="absolute z-30"
          style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="rounded-lg shadow-xl bg-white dark:bg-slate-800 overflow-hidden"
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Type note…"
              rows={2}
              className="w-44 px-2 py-0 bg-transparent resize-none focus:outline-none"
              style={{
                fontSize: `${pendingFontSize}px`,
                color: pendingColor,
                lineHeight: "1.4",
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Enter to save · Esc to cancel</p>
        </div>
      )}
    </>
  );
}
