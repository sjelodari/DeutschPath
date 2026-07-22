"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { getGrammarRoadmap, practiceGrammar, generateGrammarExercises, translateGrammarRule, completeGrammarExercise, NetworkError } from "@/src/lib/api";
import { useAppStore } from "@/src/lib/store";
import type { Language } from "@/src/lib/languages";
import {
  BookOpen, MessageSquare, ChevronDown, ChevronUp, Lock, CheckCircle,
  Send, ArrowRight, RotateCcw, Lightbulb, X,
  CheckCircle2, XCircle, Dumbbell, Sparkles, ChevronRight, Trophy,
} from "lucide-react";
import { clsx } from "clsx";
import { ConfirmLeaveDialog } from "@/src/components/layout/ConfirmLeaveDialog";
import { slugifyRuleName } from "@/src/lib/locale";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type LessonTab = "learn" | "exercises" | "chat";

/** Translated label for a grammar rule; falls back to the raw DB name if a
 *  catalog is missing the key (e.g. a rule added after a catalog was last updated). */
function ruleDisplayName(t: (key: string) => string, rule: { name: string }): string {
  try {
    return t(`ruleName_${slugifyRuleName(rule.name)}`);
  } catch {
    return rule.name;
  }
}

/** `type` comes from Gemini's free-text exercise-generation output, not a fixed
 *  enum — fall back to the raw value if it's ever outside the catalog's known keys. */
function exerciseTypeLabel(t: (key: string) => string, type: string): string {
  try {
    return t(`exType_${type}`);
  } catch {
    return type.replace(/_/g, " ");
  }
}

interface Exercise {
  type: "fill_blank" | "multiple_choice" | "translate" | "correct_error";
  instruction: string;
  prompt_de: string | null;
  prompt_en: string | null;
  answer: string;
  options: string[] | null;
  hint: string;
  explanation_en: string;
  explanation_secondary: string;
}

interface ExResult { userAnswer: string; correct: boolean }

const EX_TYPE_COLOR: Record<string, string> = {
  fill_blank: "bg-blue-100 text-blue-700 border-blue-200",
  multiple_choice: "bg-violet-100 text-violet-700 border-violet-200",
  translate: "bg-amber-100 text-amber-700 border-amber-200",
  correct_error: "bg-rose-100 text-rose-700 border-rose-200",
};

// Normalise for comparison: trim, lowercase, strip trailing punctuation
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.!?,;:]+$/, "").replace(/\s+/g, " ");
}

function FillBlankText({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-block border-b-2 border-brand-500 min-w-[3rem] mx-1 align-bottom" />
          )}
        </span>
      ))}
    </span>
  );
}

// ── Tutor message markdown renderer ───────────────────────────────────────

const RTL_RE_G = /[؀-ۿݐ-ݿ]/;

// Strip lone asterisks that weren't consumed by bold/italic matching
function stripOrphanAsterisks(s: string): string {
  return s.replace(/(?<!\*)\*(?!\*)/g, "");
}

function parseBoldG(text: string): React.ReactNode[] {
  const clean = text.replace(/\\([_*`[\]])/g, "$1");
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0; let match: RegExpExecArray | null; let k = 0;
  while ((match = regex.exec(clean)) !== null) {
    if (match.index > lastIndex) result.push(stripOrphanAsterisks(clean.slice(lastIndex, match.index)));
    if (match[1] !== undefined) result.push(<strong key={k++} className="font-semibold text-slate-900 dark:text-slate-50">{match[1]}</strong>);
    else if (match[2] !== undefined) result.push(<em key={k++} className="italic text-brand-700 dark:text-brand-300 not-italic font-medium">{match[2]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < clean.length) result.push(stripOrphanAsterisks(clean.slice(lastIndex)));
  return result;
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rest = text; let k = 0;
  while (rest.length) {
    const tick = rest.indexOf("`");
    if (tick === -1) { parts.push(...parseBoldG(rest)); break; }
    if (tick > 0) parts.push(...parseBoldG(rest.slice(0, tick)));
    const end = rest.indexOf("`", tick + 1);
    if (end === -1) { parts.push(...parseBoldG(rest.slice(tick))); break; }
    parts.push(<code key={k++} className="font-mono text-[0.82em] bg-slate-100 dark:bg-slate-700 px-1 rounded text-brand-700 dark:text-brand-200">{rest.slice(tick + 1, end)}</code>);
    rest = rest.slice(end + 1);
  }
  return parts;
}

function lineDir(line: string, containerRtl: boolean): "ltr" | "rtl" {
  if (line.startsWith("🇩🇪")) return "ltr";
  // First meaningful letter decides direction
  const first = line.match(/[A-Za-z؀-ۿݐ-ݿ]/);
  if (first) return /[A-Za-z]/.test(first[0]) ? "ltr" : "rtl";
  return containerRtl ? "rtl" : "ltr";
}

function renderTutorMd(text: string, rtl = false): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2.5 text-[0.875rem] leading-[1.65]">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n").filter(l => l.trim());
        if (!lines.length) return null;

        // Heading
        if (lines.length === 1 && lines[0].startsWith("## ")) {
          const hBody = lines[0].slice(3);
          const d = lineDir(hBody, rtl);
          return (
            <p key={pi} dir={d} className={clsx(
              "font-semibold text-brand-700 dark:text-brand-300 text-[0.85rem] uppercase tracking-wide mt-1",
              d === "rtl" && "text-right"
            )}>
              {hBody}
            </p>
          );
        }

        const isBullet   = (l: string) => /^[-*•]\s/.test(l.trim());
        const isNumbered = (l: string) => /^\d+[.)]\s/.test(l.trim());

        // Bullet list
        if (lines.every(isBullet)) {
          return (
            <ul key={pi} className="space-y-1">
              {lines.map((l, li) => {
                const body = l.replace(/^[-*•]\s/, "");
                const d = lineDir(body, rtl);
                return (
                  <li key={li} dir={d} className={clsx(
                    "flex gap-2 items-start",
                    d === "rtl" ? "pr-3 flex-row-reverse" : "pl-3"
                  )}>
                    <span className="mt-[0.45em] w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                    <span>{parseInline(body)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Numbered list
        if (lines.every(isNumbered)) {
          return (
            <ol key={pi} className="space-y-1.5 list-none">
              {lines.map((l, li) => {
                const body = l.replace(/^\d+[.)]\s/, "");
                const d = lineDir(body, rtl);
                return (
                  <li key={li} dir={d} className={clsx(
                    "flex gap-2 items-start",
                    d === "rtl" ? "pr-3 flex-row-reverse" : "pl-3"
                  )}>
                    <span className="shrink-0 font-semibold text-brand-600 dark:text-brand-400 w-5">{li + 1}.</span>
                    <span>{parseInline(body)}</span>
                  </li>
                );
              })}
            </ol>
          );
        }

        // Plain paragraph — per-line direction
        return (
          <p key={pi}>
            {lines.map((l, li) => {
              const d = lineDir(l, rtl);
              // Split "Latin-keyword: RTL-explanation" lines into two blocks
              if (d === "ltr" && RTL_RE_G.test(l)) {
                const colonIdx = l.indexOf(":");
                if (colonIdx > 0 && colonIdx < l.length - 1) {
                  const label = l.slice(0, colonIdx + 1).trim();
                  const body  = l.slice(colonIdx + 1).trim();
                  const bodyD = lineDir(body, rtl);
                  return (
                    <span key={li} className="block">
                      <span dir="ltr" className="inline text-left">{parseInline(label)} </span>
                      <span dir={bodyD} className={clsx("block", bodyD === "rtl" ? "text-right" : "text-left")}>{parseInline(body)}</span>
                    </span>
                  );
                }
              }
              return (
                <span key={li} dir={d} className={clsx("block", d === "rtl" ? "text-right" : "text-left")}>
                  {parseInline(l)}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

// ── Example sentence card ──────────────────────────────────────────────────

function ExampleCard({ de, en, secondary, rtl }: { de: string; en: string; secondary: string; rtl: boolean }) {
  const sentences = de.split(/\.\s+|(?<=\.)\s+/).filter(Boolean);
  const enSentences = en.split(/\.\s+|(?<=\.)\s+/).filter(Boolean);
  const secondarySentences = secondary.split(/\.\s+|(?<=\.)\s+/).filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {sentences.map((s, i) => (
        <div key={i} className={clsx("px-4 py-2.5", i > 0 && "border-t border-slate-100 dark:border-slate-800")}>
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm" dir="ltr" lang="de">{s.endsWith(".") ? s : `${s}.`}</p>
          {enSentences[i] && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{enSentences[i]}</p>
          )}
          {secondarySentences[i] && (
            <p
              className="text-xs text-slate-400 dark:text-slate-500 mt-0.5"
              dir={rtl ? "rtl" : "ltr"}
              style={rtl ? { textAlign: "right" } : {}}
            >
              {secondarySentences[i]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Learn tab ─────────────────────────────────────────────────────────────

function LearnTab({
  rule, secondLang, onStartExercises,
}: { rule: any; secondLang: Language; onStartExercises: () => void }) {
  const t = useTranslations("grammar");
  const [secondaryText, setSecondaryText] = useState<string | null>(null);
  const [translatedExample, setTranslatedExample] = useState<string>("");
  const [translating, setTranslating] = useState(false);

  // Fetch translation whenever rule or secondLang changes
  useEffect(() => {
    setSecondaryText(null);
    setTranslatedExample("");
    setTranslating(true);
    translateGrammarRule(rule.id, secondLang.code, secondLang.name)
      .then((r) => { setSecondaryText(r.explanation); setTranslatedExample(r.example || ""); })
      .catch(() => setSecondaryText(rule.persian_explanation || null))
      .finally(() => setTranslating(false));
  }, [rule.id, secondLang.code, secondLang.name]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Pattern */}
      <div>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("pattern")}</p>
        <div className="bg-slate-900 text-emerald-400 font-mono text-sm px-4 py-3 rounded-xl leading-relaxed" dir="ltr" lang="de">
          {rule.pattern}
        </div>
      </div>

      {/* Explanations */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wide mb-2 flex items-center gap-1">
            <span>🇬🇧</span> {t("english")}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{rule.english_explanation}</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-2">
            {secondLang.nativeName}
            <span className="font-normal text-indigo-400 dark:text-indigo-500 ms-1">({secondLang.name})</span>
          </p>
          {translating ? (
            <div className="flex items-center gap-2 text-xs text-indigo-400 dark:text-indigo-500">
              <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              {t("translating")}
            </div>
          ) : (
            <p
              className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
              dir={secondLang.rtl ? "rtl" : "ltr"}
              style={secondLang.rtl ? { textAlign: "right" } : {}}
            >
              {secondaryText || rule.english_explanation}
            </p>
          )}
        </div>
      </div>

      {/* Examples */}
      {rule.example_de && (
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("examples")}</p>
          <ExampleCard
            de={rule.example_de}
            en={rule.example_en || ""}
            secondary={translatedExample}
            rtl={secondLang.rtl}
          />
        </div>
      )}

      {/* Prerequisites */}
      {rule.prerequisites?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("prerequisites")}</p>
          <div className="flex flex-wrap gap-2">
            {rule.prerequisites.map((p: string) => (
              <span key={p} className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="pt-2">
        <button
          onClick={onStartExercises}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
        >
          <Dumbbell size={16} />
          {t("startExercises")}
          <ArrowRight size={16} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

const PASS_THRESHOLD = 0.6; // 60 % correct = pass

// ── Exercises tab ─────────────────────────────────────────────────────────

function ExercisesTab({
  rule, userLevel, secondLang, onRuleMastered, onNextRule,
}: {
  rule: any; userLevel: string; secondLang: Language;
  onRuleMastered: () => void;
  onNextRule: (() => void) | null;
}) {
  const t = useTranslations("grammar");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<Record<number, ExResult>>({});
  const [input, setInput] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [masteryResult, setMasteryResult] = useState<{
    mastered: boolean; already_mastered: boolean; passed_this_session: boolean;
  } | null>(null);
  const completedCalledRef = useRef(false);

  // Load exercises; cancelled flag prevents stale responses from overwriting state
  // (guards against React StrictMode double-invocation and mid-session rule changes)
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setExercises([]);
    setResults({});
    setCurrentIdx(0);
    setSubmitted(false);
    setInput("");
    setShowHint(false);

    generateGrammarExercises(rule.id, userLevel, secondLang.name, secondLang.code)
      .then((data) => { if (!cancelled) setExercises(data.exercises || []); })
      .catch(()    => { if (!cancelled) setExercises([]); })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [rule.id, userLevel]);

  // When all exercises are done, record completion once and update mastery
  const allDoneComputed = exercises.length > 0 && Object.keys(results).length >= exercises.length;
  useEffect(() => {
    if (!allDoneComputed || completedCalledRef.current) return;
    completedCalledRef.current = true;
    const correct = Object.values(results).filter(r => r.correct).length;
    completeGrammarExercise(rule.id, correct, exercises.length)
      .then(data => {
        setMasteryResult(data);
        if (data.mastered && !rule.mastery?.mastered) onRuleMastered();
      })
      .catch(() => setMasteryResult(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDoneComputed]);

  // Manual reload for "Try again" and "New set" buttons (always intentional, no cancellation needed)
  const reloadExercises = async () => {
    completedCalledRef.current = false;
    setMasteryResult(null);
    setLoading(true);
    setExercises([]);
    setResults({});
    setCurrentIdx(0);
    setSubmitted(false);
    setInput("");
    setShowHint(false);
    try {
      const data = await generateGrammarExercises(rule.id, userLevel, secondLang.name, secondLang.code);
      setExercises(data.exercises || []);
    } catch {
      setExercises([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset input when moving to next exercise
  useEffect(() => {
    const ex = exercises[currentIdx];
    if (!ex) return;
    setInput(ex.type === "correct_error" ? (ex.prompt_de || "") : "");
    setSelectedOption("");
    setShowHint(false);
    setSubmitted(false);
  }, [currentIdx, exercises]);

  const ex = exercises[currentIdx];
  const score = Object.values(results).filter((r) => r.correct).length;
  const allDone = allDoneComputed;

  const handleSubmit = () => {
    if (!ex || submitted) return;
    const answer = ex.type === "multiple_choice" ? selectedOption : input;
    if (!answer.trim()) return;
    const correct = normalize(answer) === normalize(ex.answer);
    setResults((r) => ({ ...r, [currentIdx]: { userAnswer: answer, correct } }));
    setSubmitted(true);
  };

  const handleNext = () => {
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">{t("generatingExercises")}</p>
      </div>
    );
  }

  if (!exercises.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("couldNotLoad")}</p>
        <button
          onClick={reloadExercises}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
        >
          <RotateCcw size={14} /> {t("tryAgain")}
        </button>
      </div>
    );
  }

  // ── All done — summary screen ─────────────────────────────────────────────
  if (allDone) {
    const pct = Math.round((score / exercises.length) * 100);
    const passedNow   = masteryResult?.passed_this_session ?? (pct >= PASS_THRESHOLD * 100);
    const alreadyHad  = masteryResult?.already_mastered ?? rule.mastery?.mastered ?? false;
    const showAsPassed = passedNow || alreadyHad;

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── Result banner ── */}
        {showAsPassed ? (
          <div className={clsx(
            "rounded-2xl p-5 flex items-center gap-4",
            alreadyHad && !passedNow
              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          )}>
            <div className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
              alreadyHad && !passedNow ? "bg-blue-100 dark:bg-blue-900/40" : "bg-green-100 dark:bg-green-900/40"
            )}>
              <Trophy size={22} className={alreadyHad && !passedNow ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"} />
            </div>
            <div>
              <p className={clsx(
                "font-bold text-base",
                alreadyHad && !passedNow ? "text-blue-700 dark:text-blue-300" : "text-green-700 dark:text-green-300"
              )}>
                {alreadyHad && !passedNow ? t("alreadyMastered") : t("ruleMastered")}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                {t("scoreLine", { score, total: exercises.length, pct })}
                {alreadyHad && !passedNow && ` ${t("alreadyPassedNote")}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-5 flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <RotateCcw size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-base text-amber-700 dark:text-amber-300">{t("keepPractising")}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                {t("scoreLineNeed", { score, total: exercises.length, pct, need: Math.round(PASS_THRESHOLD * 100) })}
              </p>
            </div>
          </div>
        )}

        {/* ── Per-question results ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("questionBreakdown")}</p>
          </div>
          {exercises.map((exItem, i) => {
            const res = results[i];
            return (
              <div
                key={i}
                className={clsx(
                  "px-4 py-3 flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0",
                  res?.correct
                    ? "bg-green-50/50 dark:bg-green-900/10"
                    : "bg-red-50/50 dark:bg-red-900/10"
                )}
              >
                <div className={clsx(
                  "mt-0.5 shrink-0",
                  res?.correct ? "text-green-500" : "text-red-400"
                )}>
                  {res?.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      EX_TYPE_COLOR[exItem.type]
                    )}>
                      {exerciseTypeLabel(t, exItem.type)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{t("questionN", { n: i + 1 })}</span>
                  </div>
                  {!res?.correct && (
                    <div className="mt-1.5 space-y-0.5 text-xs">
                      <p className="text-slate-500 dark:text-slate-400">
                        <span className="text-red-500">{t("yoursLabel")}</span>{" "}
                        <span className="font-mono" dir="ltr" lang="de">{res?.userAnswer || "—"}</span>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        <span className="text-green-600">{t("answerLabel")}</span>{" "}
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr" lang="de">{exItem.answer}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2 pt-1">
          {showAsPassed && onNextRule && (
            <button
              onClick={onNextRule}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              {t("nextRule")} <ArrowRight size={14} className="rtl:-scale-x-100" />
            </button>
          )}
          <button
            onClick={reloadExercises}
            className={clsx(
              "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
              showAsPassed
                ? "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                : "bg-brand-600 text-white hover:bg-brand-700"
            )}
          >
            <RotateCcw size={14} />
            {showAsPassed ? t("practiceAgain") : t("tryAgainCap")}
          </button>
        </div>
      </div>
    );
  }

  const result = results[currentIdx];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="px-6 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("exerciseProgress", { current: currentIdx + 1, total: exercises.length })}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("correctSoFar", { count: score })}</p>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
          <div
            className="h-1.5 bg-brand-500 rounded-full transition-all"
            style={{ width: `${((currentIdx) / exercises.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Exercise card */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {/* Type badge + instruction */}
        <div className="flex items-center gap-2">
          <span className={clsx("text-xs font-semibold px-2.5 py-1 rounded-full border", EX_TYPE_COLOR[ex.type])}>
            {exerciseTypeLabel(t, ex.type)}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{ex.instruction}</p>

        {/* The question */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          {ex.type === "translate" ? (
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t("translateIntoGerman")}</p>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{ex.prompt_en}</p>
            </div>
          ) : ex.type === "fill_blank" ? (
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100" dir="ltr" lang="de">
                <FillBlankText text={ex.prompt_de || ""} />
              </p>
              {ex.prompt_en && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">({ex.prompt_en})</p>}
            </div>
          ) : (
            <div>
              {ex.type === "correct_error" && (
                <p className="text-xs text-rose-500 mb-1">{t("hasError")}</p>
              )}
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100" dir="ltr" lang="de">{ex.prompt_de}</p>
              {ex.prompt_en && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">({ex.prompt_en})</p>}
            </div>
          )}
        </div>

        {/* Hint */}
        {!submitted && (
          <div>
            {showHint ? (
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                <Lightbulb size={13} className="mt-0.5 shrink-0" />
                {ex.hint}
              </div>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-amber-600 transition-colors"
              >
                <Lightbulb size={13} /> {t("showHint")}
              </button>
            )}
          </div>
        )}

        {/* Input area */}
        {!submitted && (
          <>
            {ex.type === "multiple_choice" && ex.options ? (
              <div className="grid grid-cols-2 gap-2">
                {ex.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedOption(opt)}
                    className={clsx(
                      "px-4 py-3 rounded-xl border text-sm font-medium text-start transition-all",
                      selectedOption === opt
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                  placeholder={ex.type === "correct_error" ? t("phCorrectSentence") : t("phTypeAnswer")}
                  rows={2}
                  dir="ltr"
                  lang="de"
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={ex.type === "multiple_choice" ? !selectedOption : !input.trim()}
              className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              {t("submitAnswer")}
            </button>
          </>
        )}

        {/* Feedback */}
        {submitted && result && (
          <div className={clsx(
            "p-4 rounded-xl border space-y-2",
            result.correct
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40"
          )}>
            <div className="flex items-center gap-2">
              {result.correct
                ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                : <XCircle size={18} className="text-red-500 shrink-0" />
              }
              <p className={clsx("font-semibold text-sm", result.correct ? "text-green-700" : "text-red-600")}>
                {result.correct ? t("correct") : t("notQuite")}
              </p>
            </div>

            {!result.correct && (
              <div className="text-sm">
                <span className="text-slate-500 dark:text-slate-400 text-xs">{t("correctAnswer")} </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100" dir="ltr" lang="de">{ex.answer}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ex.explanation_en}</p>
            {ex.explanation_secondary && (
              <p
                className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
                dir={secondLang.rtl ? "rtl" : "ltr"}
                style={secondLang.rtl ? { textAlign: "right" } : {}}
              >
                {ex.explanation_secondary}
              </p>
            )}
          </div>
        )}

        {/* Next / Finish */}
        {submitted && (
          <button
            onClick={currentIdx < exercises.length - 1 ? handleNext : () => setCurrentIdx(exercises.length)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            {currentIdx < exercises.length - 1 ? (
              <><ArrowRight size={14} className="rtl:-scale-x-100" /> {t("nextExercise")}</>
            ) : (
              <><CheckCircle2 size={14} /> {t("seeResults")}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chat tab ──────────────────────────────────────────────────────────────

// Quick-action prompts stay in English — they are instructions sent to the AI
// tutor; the tutor's reply language is controlled by the EN/secondary toggle.
const QUICK_ACTIONS = [
  { key: "teach",    msg: "Please teach me this grammar rule from the beginning with clear examples." },
  { key: "exercise", msg: "Please give me a practice exercise for this rule." },
  { key: "example",  msg: "Can you explain this rule with a clear example?" },
  { key: "harder",   msg: "Give me a harder exercise using this grammar rule." },
  { key: "mistakes", msg: "What are common mistakes students make with this rule?" },
];

function ChatTab({ rule, userLevel, secondLang }: { rule: any; userLevel: string; secondLang: Language }) {
  const t = useTranslations("grammar");
  const { setHasPendingChat } = useAppStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [teachLang, setTeachLang] = useState<"en" | "secondary">("en");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasSecondary = secondLang.code !== "en";
  const teachingInSecondary = teachLang === "secondary" && hasSecondary;
  const teachLangName = teachingInSecondary ? secondLang.name : "English";
  const secondaryLabel = teachingInSecondary ? "English" : secondLang.name;

  useEffect(() => {
    setHasPendingChat(messages.length > 0);
  }, [messages]);

  useEffect(() => {
    return () => setHasPendingChat(false);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await practiceGrammar(rule.id, text, sessionId, userLevel, secondLang.name, teachLangName);
      setSessionId(res.session_id);
      setMessages((m) => [...m, { role: "tutor", ...res, _teachingInSecondary: teachingInSecondary, _secondaryRtl: secondLang.rtl }]);
    } catch (err) {
      const msg = err instanceof NetworkError
        ? t("errOffline")
        : t("errAi");
      setMessages((m) => [...m, { role: "tutor", tutor_response_de: msg }]);
    } finally {
      setSending(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Quick actions + language toggle */}
      {!hasMessages && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{t("quickStart")}</p>
            {hasSecondary && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setTeachLang("en")}
                  className={clsx(
                    "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
                    teachLang === "en"
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setTeachLang("secondary")}
                  className={clsx(
                    "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
                    teachLang === "secondary"
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  {secondLang.code.toUpperCase()}
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ key, msg }) => (
              <button
                key={key}
                onClick={() => send(msg)}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors"
              >
                {t(`quickAction_${key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages && (
          <div className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
            <Sparkles size={28} className="mx-auto mb-2 opacity-40" />
            <p>{t.rich("chatEmpty", {
              rule: () => <strong className="text-slate-600 dark:text-slate-300">{ruleDisplayName(t, rule)}</strong>,
            })}</p>
            <p className="text-xs mt-1">{t("chatEmptyHint")}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "tutor" && (
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold me-2 mt-1 shrink-0">
                T
              </div>
            )}
            <div className={clsx(
              "max-w-[78%] space-y-2",
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              {/* Main bubble */}
              {(() => {
                const mainRtl = msg._teachingInSecondary && msg._secondaryRtl;
                const secRtl  = !msg._teachingInSecondary && secondLang.rtl;
                return (
                  <div className={clsx(
                    "rounded-2xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-brand-600 text-white rounded-ee-sm"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-es-sm shadow-sm"
                  )}>
                    {msg.role === "user"
                      ? <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      : renderTutorMd(msg.tutor_response_de, mainRtl)
                    }
                  </div>
                );
              })()}

              {/* Correction card */}
              {msg.correction && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <XCircle size={13} /> {t("correction")}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono" dir="ltr" lang="de">{msg.correction}</p>
                  {msg.what_was_wrong && (
                    <p
                      className="text-xs text-slate-600 dark:text-slate-300"
                      dir={msg._teachingInSecondary && msg._secondaryRtl ? "rtl" : "ltr"}
                    >
                      {msg.what_was_wrong}
                    </p>
                  )}
                  {msg.explanation_secondary && (
                    <p
                      className="text-xs text-slate-500 dark:text-slate-400"
                      dir={!msg._teachingInSecondary && secondLang.rtl ? "rtl" : "ltr"}
                    >
                      {msg.explanation_secondary}
                    </p>
                  )}
                </div>
              )}

              {/* Exercise card */}
              {msg.exercise && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                    <Dumbbell size={12} /> {t("exercise")}
                  </p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{msg.exercise}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">T</div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-es-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          {hasSecondary && (
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shrink-0">
              <button
                onClick={() => setTeachLang("en")}
                className={clsx(
                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors",
                  teachLang === "en"
                    ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                )}
                title={t("tutorRespondsEn")}
              >
                EN
              </button>
              <button
                onClick={() => setTeachLang("secondary")}
                className={clsx(
                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors",
                  teachLang === "secondary"
                    ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                )}
                title={t("tutorRespondsIn", { lang: secondLang.name })}
              >
                {secondLang.code.toUpperCase()}
              </button>
            </div>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder={t("chatPlaceholder")}
            dir="auto"
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lesson panel ──────────────────────────────────────────────────────────

function LessonPanel({ rule, onClose, userLevel, secondLang, onRuleMastered, onNextRule }: {
  rule: any; onClose: () => void; userLevel: string; secondLang: Language;
  onRuleMastered: () => void;
  onNextRule: (() => void) | null;
}) {
  const t = useTranslations("grammar");
  const [tab, setTab] = useState<LessonTab>("learn");

  // Reset to learn when rule changes
  useEffect(() => { setTab("learn"); }, [rule.id]);

  const tabs: { id: LessonTab; label: string; icon: React.ReactNode }[] = [
    { id: "learn",     label: t("tabLesson"),    icon: <BookOpen size={14} /> },
    { id: "exercises", label: t("tabExercises"), icon: <Dumbbell size={14} /> },
    { id: "chat",      label: t("tabChat"),      icon: <MessageSquare size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-s border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-50 text-base leading-tight">{ruleDisplayName(t, rule)}</h2>
            <div className="flex items-center gap-2 mt-1">
              <LevelBadge level={rule.cefr_level} />
              {rule.pattern && (
                <code className="text-xs bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded truncate max-w-xs" dir="ltr" lang="de">
                  {rule.pattern}
                </code>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ms-4 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === id
                  ? "bg-brand-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === "learn" && (
          <LearnTab rule={rule} secondLang={secondLang} onStartExercises={() => setTab("exercises")} />
        )}
        {tab === "exercises" && (
          <ExercisesTab rule={rule} userLevel={userLevel} secondLang={secondLang}
            onRuleMastered={onRuleMastered} onNextRule={onNextRule} />
        )}
        {tab === "chat" && (
          <ChatTab rule={rule} userLevel={userLevel} secondLang={secondLang} />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

const ENGLISH_LANG: Language = { code: "en", name: "English", nativeName: "English", rtl: false };

export default function GrammarPage() {
  const t = useTranslations("grammar");
  const { userLevel, translationLanguages, hasPendingChat, setHasPendingChat } = useAppStore();
  const secondLang: Language =
    translationLanguages.find((l) => l.code !== "en") ?? ENGLISH_LANG;

  const [roadmap, setRoadmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLevel, setExpandedLevel] = useState<string>(userLevel);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Flat ordered list of all rules for next-rule navigation
  const allRules = LEVELS.flatMap(l => roadmap?.[l]?.rules ?? []);
  const nextRule: any | null = (() => {
    if (!selectedRule || !roadmap) return null;
    const idx = allRules.findIndex((r: any) => r.id === selectedRule.id);
    return idx >= 0 && idx < allRules.length - 1 ? allRules[idx + 1] : null;
  })();

  // Called when an exercise session newly masters a rule
  const handleRuleMastered = () => {
    // Update the rule in the roadmap sidebar immediately
    setRoadmap((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const lvl of LEVELS) {
        if (!next[lvl]) continue;
        const updatedRules = next[lvl].rules.map((r: any) =>
          r.id === selectedRule?.id ? { ...r, mastery: { ...r.mastery, mastered: true } } : r
        );
        next[lvl] = {
          ...next[lvl],
          rules: updatedRules,
          mastered: updatedRules.filter((r: any) => r.mastery?.mastered).length,
        };
      }
      return next;
    });
    // Also update the open rule so the panel reflects mastery immediately
    setSelectedRule((r: any) => r ? { ...r, mastery: { ...r.mastery, mastered: true } } : r);
  };

  const guardedAction = (action: () => void) => {
    if (hasPendingChat) {
      setPendingAction(() => action);
    } else {
      action();
    }
  };

  useEffect(() => {
    getGrammarRoadmap()
      .then(setRoadmap)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isLocked = (level: string) => {
    const idx = LEVELS.indexOf(level as typeof LEVELS[number]);
    const userIdx = LEVELS.indexOf(userLevel as typeof LEVELS[number]);
    return idx > userIdx + 1;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {pendingAction && (
        <ConfirmLeaveDialog
          onConfirm={() => { setHasPendingChat(false); pendingAction(); setPendingAction(null); }}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {/* ── Roadmap sidebar ── */}
      <div className={clsx(
        "flex flex-col overflow-y-auto bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 transition-all shrink-0",
        selectedRule ? "w-72" : "w-full max-w-2xl mx-auto border-e-0"
      )}>
        <div className="p-5">
          {!selectedRule && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("subtitle")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {LEVELS.map((level) => {
              const data = roadmap?.[level];
              if (!data) return null;
              const locked = isLocked(level);
              const expanded = expandedLevel === level;
              const pct = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;

              return (
                <div
                  key={level}
                  className={clsx(
                    "rounded-xl border transition-all",
                    locked ? "border-slate-200 dark:border-slate-700 opacity-50" : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  {/* Level header */}
                  <button
                    onClick={() => !locked && setExpandedLevel(expanded ? "" : level)}
                    disabled={locked}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      {locked ? (
                        <Lock size={14} className="text-slate-400 dark:text-slate-500" />
                      ) : data.mastered === data.total && data.total > 0 ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-400" />
                      )}
                      <LevelBadge level={level} size="md" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{data.mastered}/{data.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!locked && (
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {!locked && (expanded ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />)}
                    </div>
                  </button>

                  {/* Rules list */}
                  {expanded && !locked && (
                    <div className="border-t border-slate-100 dark:border-slate-800">
                      {data.rules.map((rule: any) => {
                        const isSelected = selectedRule?.id === rule.id;
                        return (
                          <button
                            key={rule.id}
                            onClick={() => guardedAction(() => setSelectedRule(isSelected ? null : rule))}
                            className={clsx(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors border-b border-slate-50 dark:border-slate-900 last:border-0",
                              isSelected
                                ? "bg-brand-50 dark:bg-brand-900/20 border-s-2 border-s-brand-500"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {rule.mastery?.mastered
                              ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                              : <div className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className={clsx(
                                "text-sm font-medium truncate",
                                isSelected ? "text-brand-700" : "text-slate-700 dark:text-slate-200"
                              )}>
                                {ruleDisplayName(t, rule)}
                              </p>
                              {!selectedRule && rule.pattern && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-mono mt-0.5" dir="ltr" lang="de">{rule.pattern}</p>
                              )}
                            </div>
                            <ChevronRight size={13} className={clsx("shrink-0 rtl:-scale-x-100", isSelected ? "text-brand-500" : "text-slate-300 dark:text-slate-600")} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Lesson panel ── */}
      {selectedRule && (
        <LessonPanel
          rule={selectedRule}
          onClose={() => guardedAction(() => setSelectedRule(null))}
          userLevel={userLevel}
          secondLang={secondLang}
          onRuleMastered={handleRuleMastered}
          onNextRule={nextRule ? () => setSelectedRule(nextRule) : null}
        />
      )}
    </div>
  );
}
