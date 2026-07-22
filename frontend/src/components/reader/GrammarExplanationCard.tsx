"use client";

import { X, BookmarkPlus, Check, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { LevelBadge } from "@/src/components/layout/LevelBadge";

interface Props {
  analysis: any;
  onSave: () => void;
  onPractice: () => void;
  onClose: () => void;
  saved: boolean;
  loading: boolean;
  position: { x: number; y: number };
}

export function GrammarExplanationCard({ analysis, onSave, onPractice, onClose, saved, loading, position }: Props) {
  const t = useTranslations("grammarCard");
  const style = {
    left: Math.min(position.x, window.innerWidth - 360),
    top: position.y + 12,
  };

  return (
    <div
      className="fixed z-50 w-88 bg-white rounded-xl shadow-2xl border border-slate-200 text-sm"
      style={{ ...style, width: 340 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-indigo-50 rounded-t-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-indigo-900">{analysis.rule_name}</span>
            {analysis.cefr_level && <LevelBadge level={analysis.cefr_level} />}
          </div>
          {analysis.pattern && (
            <code className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded mt-1 inline-block">
              {analysis.pattern}
            </code>
          )}
        </div>
        <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 mt-0.5">
          <X size={16} />
        </button>
      </div>

      {/* Explanations */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("english")}</p>
          <p className="text-slate-700">{analysis.english_explanation}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">فارسی</p>
          <p className="text-slate-700 rtl text-right">{analysis.persian_explanation}</p>
        </div>
      </div>

      {/* Example */}
      {analysis.example_de && (
        <div className="px-4 pb-3 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("example")}</p>
          <p className="text-slate-800 italic font-medium">{analysis.example_de}</p>
          <p className="text-slate-500 text-xs">{analysis.example_en}</p>
          <p className="text-slate-500 text-xs rtl text-right">{analysis.example_fa}</p>
        </div>
      )}

      {/* Tip */}
      {analysis.tip && (
        <div className="mx-4 mb-3 p-2 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-800"><span className="font-semibold">{t("tip")}</span> {analysis.tip}</p>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
        <button
          onClick={onPractice}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <MessageSquare size={14} />
          {t("practice")}
        </button>
        <button
          onClick={onSave}
          disabled={loading || saved}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved ? "bg-green-100 text-green-700" : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}
          {saved ? t("savedBang") : loading ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
