"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/src/lib/speak";
import { reviewWord } from "@/src/lib/api";
import { Volume2, RotateCcw, Trophy, X, Check } from "lucide-react";
import { useAppStore } from "@/src/lib/store";
import { getTranslation } from "@/src/lib/languages";

const LANG_FLAG: Record<string, string> = {
  de: "🇩🇪", en: "🇬🇧", fa: "🇮🇷", fr: "🇫🇷", es: "🇪🇸",
  it: "🇮🇹", pt: "🇵🇹", nl: "🇳🇱", pl: "🇵🇱", tr: "🇹🇷",
  ru: "🇷🇺", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", ar: "🇸🇦",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

type Direction = { from: string; fromLabel: string; to: string; toLabel: string; toRtl: boolean };

interface Question {
  word: any;
  prompt: string;
  promptLabel: string;
  promptIsGerman: boolean;
  promptLangCode: string;
  correct: string;
  correctRtl: boolean;
  options: string[];
}

interface Props {
  words: any[];
  onClose: () => void;
}

function buildQuestion(words: any[], dir: Direction): Question | null {
  if (words.length < 2) return null;
  const correct = words[Math.floor(Math.random() * words.length)];
  const distractors = words
    .filter((w) => w.id !== correct.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const getPromptVal = (w: any) =>
    dir.from === "de" ? w.german : getTranslation(w, dir.from) || w.german;
  const getAnswerVal = (w: any) =>
    dir.to === "de" ? w.german : getTranslation(w, dir.to) || "";

  const options = [...distractors, correct]
    .sort(() => Math.random() - 0.5)
    .map((w) => getAnswerVal(w))
    .filter(Boolean);

  return {
    word: correct,
    prompt: getPromptVal(correct),
    promptLabel: dir.fromLabel,
    promptIsGerman: dir.from === "de",
    promptLangCode: dir.from,
    correct: getAnswerVal(correct),
    correctRtl: dir.toRtl,
    options,
  };
}

export function QuizGame({ words, onClose }: Props) {
  const t = useTranslations("quiz");
  const { translationLanguages } = useAppStore();

  const germanLabel = t("german");
  const directions: Direction[] = [
    { from: "de", fromLabel: germanLabel, to: "de", toLabel: germanLabel, toRtl: false },
  ];
  translationLanguages.forEach((lang) => {
    directions.push({ from: "de", fromLabel: germanLabel, to: lang.code, toLabel: lang.name, toRtl: lang.rtl });
    directions.push({ from: lang.code, fromLabel: lang.name, to: "de", toLabel: germanLabel, toRtl: false });
  });
  const validDirs = directions.filter((d) => !(d.from === "de" && d.to === "de"));

  const [dir, setDir] = useState<Direction | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [wrongWords, setWrongWords] = useState<any[]>([]);
  const MAX_QUESTIONS = Math.min(20, words.length);

  const next = useCallback(
    (direction: Direction) => {
      setQuestion(buildQuestion(words, direction));
      setAnswered(null);
    },
    [words]
  );

  const startQuiz = (d: Direction) => {
    setDir(d);
    setScore(0);
    setTotal(0);
    setStreak(0);
    setBestStreak(0);
    setWrongWords([]);
    setFinished(false);
    setQuestion(buildQuestion(words, d));
    setAnswered(null);
  };

  const handleAnswer = (chosen: string) => {
    if (answered !== null || !question || !dir) return;
    setAnswered(chosen);

    const isCorrect = chosen === question.correct;
    const newTotal = total + 1;
    setTotal(newTotal);

    reviewWord(question.word.id, isCorrect ? 4 : 2).catch(() => {});

    if (isCorrect) {
      setScore((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak((b) => Math.max(b, newStreak));
    } else {
      setStreak(0);
      setWrongWords((w) => [...w, question.word]);
    }

    setTimeout(() => {
      if (newTotal >= MAX_QUESTIONS) {
        setFinished(true);
      } else {
        next(dir);
      }
    }, 1600);
  };

  // ── Direction picker ─────────────────────────────────────────────────────────
  if (!dir) {
    return (
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t("wordsAvailable", { count: words.length })}</span>
        </div>

        <div className="text-center">
          <div className="text-4xl mb-2 select-none">🎯</div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("pickDirection")}</p>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {validDirs.map((d, i) => (
            <button
              key={i}
              onClick={() => startQuiz(d)}
              disabled={words.length < 2}
              className="w-full flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-2xl transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <span className="text-2xl select-none">{LANG_FLAG[d.from] || "🌐"}</span>
              <div className="flex-1 text-start">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.fromLabel}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("translateTo", { lang: d.toLabel })}</p>
              </div>
              <span className="text-2xl select-none">{LANG_FLAG[d.to] || "🌐"}</span>
            </button>
          ))}
        </div>

        {words.length < 2 && (
          <p className="text-xs text-center text-slate-400 dark:text-slate-500">
            {t("needTwoWords")}
          </p>
        )}
      </div>
    );
  }

  // ── Finished screen ──────────────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((score / total) * 100);
    const resultEmoji = pct >= 90 ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "👍" : "📚";

    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8">
        <div className="text-5xl select-none">{resultEmoji}</div>

        <div className="text-center">
          <p className="text-5xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
            {pct}<span className="text-3xl text-slate-400 dark:text-slate-500">%</span>
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("correctOutOf", { score, total })}
          </p>
        </div>

        {/* Score bar */}
        <div className="w-full max-w-xs">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 text-center">
          <div>
            <p className="text-xl font-bold text-orange-500 tabular-nums">{bestStreak}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("bestStreak")}</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-500 tabular-nums">{total - score}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("wrong")}</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-500 tabular-nums">{score}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("correct")}</p>
          </div>
        </div>

        {wrongWords.length > 0 && (
          <div className="w-full max-w-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-3">
            <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-2">{t("reviewTheseAgain")}</p>
            <div className="flex flex-wrap gap-1.5">
              {wrongWords.map((w, i) => (
                <span key={i} className="text-xs bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                  {w.german}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => startQuiz(dir)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            <RotateCcw size={14} /> {t("playAgain")}
          </button>
          <button
            onClick={() => setDir(null)}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t("changeMode")}
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {t("backToVocabulary")}
        </button>
      </div>
    );
  }

  if (!question) return null;

  // ── Quiz question ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full p-5 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <span className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full">
              🔥 {streak}
            </span>
          )}
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {t("scoreCorrect", { score, total })}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0">
        <div
          className="h-2 bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-300"
          style={{ width: `${(total / MAX_QUESTIONS) * 100}%` }}
        />
      </div>
      <p className="text-[11px] text-center text-slate-400 dark:text-slate-600 -mt-2 shrink-0 tabular-nums">
        {total} / {MAX_QUESTIONS}
      </p>

      {/* Question card */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 shrink-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
          {LANG_FLAG[question.promptLangCode] || "🌐"} {question.promptLabel}
        </p>
        <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {question.prompt}
            </p>
            {question.promptIsGerman && (
              <button
                onClick={() => speakGerman(question.prompt)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors shrink-0"
              >
                <Volume2 size={16} />
              </button>
            )}
          </div>
          {question.promptIsGerman && question.word.gender && question.word.gender !== "null" && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {question.word.gender} · {question.word.word_type}
            </p>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2 shrink-0">
        {question.options.map((opt, i) => {
          const isChosen = answered === opt;
          const isCorrect = opt === question.correct;
          const isRevealed = answered !== null;

          let btnCls = "w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl border-2 text-sm font-medium text-start transition-all duration-150 ";
          let badgeCls = "w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ";

          if (!isRevealed) {
            btnCls += "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-slate-700 dark:text-slate-200 cursor-pointer active:scale-[0.99]";
            badgeCls += "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400";
          } else if (isCorrect) {
            btnCls += "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
            badgeCls += "bg-green-500 text-white";
          } else if (isChosen) {
            btnCls += "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
            badgeCls += "bg-red-500 text-white";
          } else {
            btnCls += "border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed";
            badgeCls += "bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600";
          }

          return (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              disabled={isRevealed}
              className={btnCls}
              dir={question.correctRtl ? "rtl" : "ltr"}
            >
              <span className={badgeCls}>{OPTION_LABELS[i]}</span>
              <span className="flex-1">{opt}</span>
              {isRevealed && isCorrect && <Check size={16} className="shrink-0 text-green-600 dark:text-green-400" />}
              {isRevealed && isChosen && !isCorrect && <X size={16} className="shrink-0 text-red-500 dark:text-red-400" />}
            </button>
          );
        })}
      </div>

    </div>
  );
}
