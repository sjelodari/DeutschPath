"use client";

import { useState } from "react";
import { BookmarkPlus, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAppStore } from "@/src/lib/store";
import { getTranslation, getExampleTranslation } from "@/src/lib/languages";

const GENDER_STYLE: Record<string, string> = {
  der: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  die: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700",
  das: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  plural: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

const TYPE_STYLE: Record<string, string> = {
  noun:        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  verb:        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  adjective:   "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  adverb:      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  phrase:      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  conjunction: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  preposition: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  pronoun:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  other:       "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

interface Props {
  results: any[];
  onSaveVocab: (item: any) => Promise<void>;
  onDelete?: (i: number) => void;
}

export function AnalysisTable({ results, onSaveVocab, onDelete }: Props) {
  const { translationLanguages } = useAppStore();
  const langs = translationLanguages.length > 0
    ? translationLanguages
    : [{ code: "en", name: "English", nativeName: "English", rtl: false }];

  const [vocabSaved, setVocabSaved] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const wordKey = (item: any): string => item.german || item.original || "";

  const toggleExpand = (item: any) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      const k = wordKey(item);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const handleVocab = async (item: any) => {
    await onSaveVocab(item);
    setVocabSaved((prev) => new Set(prev).add(wordKey(item)));
  };

  const rows: React.ReactNode[] = [];

  results.forEach((item, i) => {
    const k = wordKey(item);
    const isExp = expanded.has(k);
    const isSaved = vocabSaved.has(k);
    const genderKey = item.gender && item.gender !== "null" ? item.gender : null;
    const typeKey = item.word_type || "other";

    rows.push(
      <tr
        key={`r${i}`}
        onClick={() => toggleExpand(item)}
        className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
      >
        {/* Word + badges */}
        <td className="px-3 py-2.5 min-w-[120px]">
          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {item.german || item.original}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_STYLE[typeKey] || TYPE_STYLE.other}`}
            >
              {typeKey}
            </span>
            {genderKey && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${GENDER_STYLE[genderKey] || ""}`}
              >
                {genderKey}
              </span>
            )}
            {item.cefr_level && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                {item.cefr_level}
              </span>
            )}
            {item.word_type === "verb" && item.extra_info?.is_separable === true && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                trennbar{item.extra_info.separable_prefix ? ` · ${item.extra_info.separable_prefix}-` : ""}
              </span>
            )}
            {item.word_type === "verb" && item.extra_info?.is_separable === false && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700">
                untrennbar
              </span>
            )}
          </div>
        </td>

        {/* Translation columns */}
        {langs.map((lang) => (
          <td
            key={lang.code}
            className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 min-w-[90px]"
            dir={lang.rtl ? "rtl" : "ltr"}
          >
            {getTranslation(item, lang.code)}
          </td>
        ))}

        {/* Actions */}
        <td className="px-2 py-2.5 w-14">
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleVocab(item)}
              title={isSaved ? "Saved to Vocabulary" : "Save to Vocabulary"}
              className={`p-1.5 rounded-lg transition-all ${
                isSaved
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
              }`}
            >
              {isSaved ? <Check size={13} /> : <BookmarkPlus size={13} />}
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(i)}
                title="Remove"
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </td>

        {/* Expand chevron */}
        <td className="pr-2 py-2.5 w-6">
          {isExp ? (
            <ChevronUp size={13} className="text-slate-400 dark:text-slate-500" />
          ) : (
            <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
          )}
        </td>
      </tr>
    );

    if (isExp) {
      rows.push(
        <tr key={`e${i}`} className="border-b border-slate-200 dark:border-slate-700 bg-brand-50 dark:bg-slate-800/50">
          <td colSpan={3 + langs.length} className="px-4 py-3 space-y-2">
            {item.example_de && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">
                  Example
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 italic">{item.example_de}</p>
                {langs.map((lang) => {
                  const ex = getExampleTranslation(item, lang.code);
                  return ex ? (
                    <p
                      key={lang.code}
                      className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
                      dir={lang.rtl ? "rtl" : "ltr"}
                    >
                      {ex}
                    </p>
                  ) : null;
                })}
              </div>
            )}
            {item.note && (
              <p
                className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-2.5 py-1.5 rounded-lg"
                dir={langs[0]?.rtl ? "rtl" : "ltr"}
              >
                {item.note}
              </p>
            )}
          </td>
        </tr>
      );
    }
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <th className="text-left px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700">
              Word
            </th>
            {langs.map((lang) => (
              <th
                key={lang.code}
                className="px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700"
                dir={lang.rtl ? "rtl" : "ltr"}
              >
                {lang.nativeName}
              </th>
            ))}
            <th className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 w-14" />
            <th className="w-6 border-b border-slate-200 dark:border-slate-700" />
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
