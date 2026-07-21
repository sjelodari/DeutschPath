"use client";

import { X, BookmarkPlus, Check, ChevronDown, ChevronUp } from "lucide-react";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  analysis: any;
  onSave: () => void;
  onClose: () => void;
  saved: boolean;
  loading: boolean;
  position: { x: number; y: number };
}

const KNOWN_TYPES = new Set(["noun", "verb", "adjective", "adverb", "phrase", "other"]);

export function WordExplanationCard({ analysis, onSave, onClose, saved, loading, position }: Props) {
  const t = useTranslations("wordCard");
  const [showExtra, setShowExtra] = useState(false);
  const extra = analysis.extra_info || {};
  const hasConjugation = extra.conjugation && Object.keys(extra.conjugation).length > 0;

  const style = {
    left: Math.min(position.x, window.innerWidth - 340),
    top: position.y + 12,
  };

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 text-sm"
      style={style}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-800">{analysis.german}</span>
            {analysis.gender && (
              <span className="text-xs text-slate-500 font-medium">{analysis.gender}</span>
            )}
            {analysis.cefr_level && <LevelBadge level={analysis.cefr_level} />}
          </div>
          <span className="text-xs text-brand-600 font-medium">
            {KNOWN_TYPES.has(analysis.word_type) ? t(`type_${analysis.word_type}`) : analysis.word_type}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5">
          <X size={16} />
        </button>
      </div>

      {/* Translations */}
      <div className="p-4 space-y-2">
        <div className="flex gap-3">
          <span className="text-xs font-semibold text-slate-400 w-4">EN</span>
          <span className="text-slate-700">{analysis.english}</span>
        </div>
        <div className="flex gap-3">
          <span className="text-xs font-semibold text-slate-400 w-4">FA</span>
          <span className="text-slate-700 rtl text-right flex-1">{analysis.persian}</span>
        </div>
      </div>

      {/* Example */}
      {analysis.example_de && (
        <div className="px-4 pb-3 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("example")}</p>
          <p className="text-slate-700 italic">{analysis.example_de}</p>
          <p className="text-slate-500 text-xs">{analysis.example_en}</p>
          <p className="text-slate-500 text-xs rtl text-right">{analysis.example_fa}</p>
        </div>
      )}

      {/* Extra info toggle */}
      {(hasConjugation || extra.plural || extra.past_participle) && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowExtra(!showExtra)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            {showExtra ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showExtra ? t("hideDetails") : t("showDetails")}
          </button>
          {showExtra && (
            <div className="mt-2 space-y-2 text-xs text-slate-600">
              {extra.plural && <p><span className="font-semibold">{t("plural")}</span> {extra.plural}</p>}
              {extra.past_participle && (
                <p>
                  <span className="font-semibold">{t("pastParticiple")}</span> {extra.past_participle}
                  {extra.auxiliary && ` (+ ${extra.auxiliary})`}
                </p>
              )}
              {hasConjugation && (
                <div>
                  <p className="font-semibold mb-1">{t("conjugation")}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {Object.entries(extra.conjugation).map(([pronoun, form]) => (
                      <span key={pronoun}>{pronoun}: <strong>{form as string}</strong></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-3 border-t border-slate-100 flex justify-end">
        <button
          onClick={onSave}
          disabled={loading || saved}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-green-100 text-green-700"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}
          {saved ? t("savedBang") : loading ? t("saving") : t("saveWord")}
        </button>
      </div>
    </div>
  );
}
