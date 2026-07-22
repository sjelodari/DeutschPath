"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Volume2, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { clsx } from "clsx";
import { speakGerman } from "@/src/lib/speak";
import { useAppStore } from "@/src/lib/store";
import { getTranslation, getExampleTranslation } from "@/src/lib/languages";

interface Props {
  word: any;
  onRate: (quality: number) => void;
}

export function FlashCard({ word, onRate }: Props) {
  const t = useTranslations("flashcard");
  const { translationLanguages } = useAppStore();
  const langs = translationLanguages.length > 0
    ? translationLanguages
    : [{ code: "en", name: "English", nativeName: "English", rtl: false }];
  const [flipped, setFlipped] = useState(false);
  const onRateRef = useRef(onRate);
  useEffect(() => { onRateRef.current = onRate; }, [onRate]);

  // Reset to front whenever word changes
  useEffect(() => { setFlipped(false); }, [word]);

  // Keyboard shortcuts: ← Again, ↓ Hard, → Got it
  useEffect(() => {
    if (!flipped) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  { setFlipped(false); onRateRef.current(1); }
      else if (e.key === "ArrowDown")  { setFlipped(false); onRateRef.current(2); }
      else if (e.key === "ArrowRight") { setFlipped(false); onRateRef.current(4); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped]);

  const rate = (q: number) => { setFlipped(false); onRate(q); };

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* Card */}
      <div
        className={clsx(
          "w-full max-w-lg min-h-64 rounded-2xl border shadow-lg p-8 transition-all duration-300",
          !flipped && "cursor-pointer active:scale-[0.99]",
          flipped
            ? "bg-white dark:bg-slate-900 border-brand-200 dark:border-brand-800"
            : "bg-brand-600 border-brand-700"
        )}
        onClick={!flipped ? () => setFlipped(true) : undefined}
      >
        {!flipped ? (
          /* Front */
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">{word.word_type}</span>
              {word.cefr_level && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">{word.cefr_level}</span>
              )}
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-center">
              {word.gender && <span className="text-2xl text-white/70 me-2">{word.gender}</span>}
              {word.german}
            </h2>
            <button
              onClick={(e) => { e.stopPropagation(); speakGerman(word.german); }}
              className="mt-2 p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <Volume2 size={18} />
            </button>
            <p className="text-white/50 text-sm mt-2">{t("tapToReveal")}</p>
          </div>
        ) : (
          /* Back */
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {word.gender && <span className="text-slate-400 dark:text-slate-500 me-1">{word.gender}</span>}
                  {word.german}
                </span>
                <button
                  onClick={() => speakGerman(word.german)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Volume2 size={14} />
                </button>
                {word.word_type === "verb" && word.extra_info?.is_separable === true && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    trennbar{word.extra_info.separable_prefix ? ` · ${word.extra_info.separable_prefix}-` : ""}
                  </span>
                )}
                {word.word_type === "verb" && word.extra_info?.is_separable === false && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                    untrennbar
                  </span>
                )}
              </div>
              <LevelBadge level={word.cefr_level} />
            </div>

            <div className="space-y-1">
              {langs.map((lang) => {
                const tr = getTranslation(word, lang.code);
                return tr ? (
                  <div key={lang.code} className="flex gap-3">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 w-6 mt-0.5 uppercase shrink-0">
                      {lang.code}
                    </span>
                    <p
                      className="text-slate-700 dark:text-slate-200 font-medium flex-1"
                      dir={lang.rtl ? "rtl" : "ltr"}
                    >
                      {tr}
                    </p>
                  </div>
                ) : null;
              })}
            </div>

            {word.example_de && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-1">
                <p className="text-sm text-slate-700 dark:text-slate-200 italic" dir="ltr" lang="de">{word.example_de}</p>
                {langs.map((lang) => {
                  const ex = getExampleTranslation(word, lang.code);
                  return ex ? (
                    <p key={lang.code} className="text-xs text-slate-500 dark:text-slate-400" dir={lang.rtl ? "rtl" : "ltr"}>
                      {ex}
                    </p>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — shown after flip */}
      {flipped && (
        <div className="w-full max-w-lg space-y-3">
          <p className="text-xs text-center text-slate-400 dark:text-slate-500">{t("howDidItGo")}</p>
          <div className="grid grid-cols-3 gap-3">

            <button
              onClick={() => rate(1)}
              className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
              <span className="text-sm font-bold">{t("again")}</span>
              <span className="text-[10px] opacity-50">{t("keyHintLeft")}</span>
            </button>

            <button
              onClick={() => rate(2)}
              className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 transition-all active:scale-95"
            >
              <Minus size={24} />
              <span className="text-sm font-bold">{t("hard")}</span>
              <span className="text-[10px] opacity-50">{t("keyHintDown")}</span>
            </button>

            <button
              onClick={() => rate(4)}
              className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 transition-all active:scale-95"
            >
              <ChevronRight size={24} />
              <span className="text-sm font-bold">{t("gotIt")}</span>
              <span className="text-[10px] opacity-50">{t("keyHintRight")}</span>
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
