"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Eye, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";

type CasesTab = "articles" | "adjectives" | "prepositions" | "pronouns" | "tips" | "practice";

const CASE_COLORS: Record<string, string> = {
  Nominative: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40",
  Accusative: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40",
  Dative:     "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40",
  Genitive:   "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40",
};
const CASE_HEADER: Record<string, string> = {
  Nominative: "bg-blue-600 text-white",
  Accusative: "bg-red-600 text-white",
  Dative:     "bg-green-600 text-white",
  Genitive:   "bg-purple-600 text-white",
};

// ── Data ──────────────────────────────────────────────────────────────────────

const CASES = ["Nominative", "Accusative", "Dative", "Genitive"] as const;
const GENDERS = ["Masculine", "Feminine", "Neuter", "Plural"] as const;

const DEFINITE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "der", Feminine: "die", Neuter: "das", Plural: "die" },
  Accusative: { Masculine: "den", Feminine: "die", Neuter: "das", Plural: "die" },
  Dative:     { Masculine: "dem", Feminine: "der", Neuter: "dem", Plural: "den" },
  Genitive:   { Masculine: "des", Feminine: "der", Neuter: "des", Plural: "der" },
};
const INDEFINITE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "ein",   Feminine: "eine",  Neuter: "ein",   Plural: "—" },
  Accusative: { Masculine: "einen", Feminine: "eine",  Neuter: "ein",   Plural: "—" },
  Dative:     { Masculine: "einem", Feminine: "einer", Neuter: "einem", Plural: "—" },
  Genitive:   { Masculine: "eines", Feminine: "einer", Neuter: "eines", Plural: "—" },
};
const NEGATIVE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "kein",   Feminine: "keine",  Neuter: "kein",   Plural: "keine" },
  Accusative: { Masculine: "keinen", Feminine: "keine",  Neuter: "kein",   Plural: "keine" },
  Dative:     { Masculine: "keinem", Feminine: "keiner", Neuter: "keinem", Plural: "keinen" },
  Genitive:   { Masculine: "keines", Feminine: "keiner", Neuter: "keines", Plural: "keiner" },
};

// Adjective endings
const ADJ_WEAK: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-e",  Feminine: "-e",  Neuter: "-e",  Plural: "-en" },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-e",  Plural: "-en" },
  Dative:     { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
};
const ADJ_MIXED: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-er", Feminine: "-e",  Neuter: "-es", Plural: "-en" },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-es", Plural: "-en" },
  Dative:     { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
};
const ADJ_STRONG: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-er", Feminine: "-e",  Neuter: "-es", Plural: "-e"  },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-es", Plural: "-e"  },
  Dative:     { Masculine: "-em", Feminine: "-er", Neuter: "-em", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-er", Neuter: "-en", Plural: "-er" },
};

// Personal pronouns
const PRONOUNS = [
  { sub: "ich",  acc: "mich", dat: "mir",   gen: "meiner" },
  { sub: "du",   acc: "dich", dat: "dir",   gen: "deiner" },
  { sub: "er",   acc: "ihn",  dat: "ihm",   gen: "seiner" },
  { sub: "sie",  acc: "sie",  dat: "ihr",   gen: "ihrer"  },
  { sub: "es",   acc: "es",   dat: "ihm",   gen: "seiner" },
  { sub: "wir",  acc: "uns",  dat: "uns",   gen: "unser"  },
  { sub: "ihr",  acc: "euch", dat: "euch",  gen: "euer"   },
  { sub: "sie",  acc: "sie",  dat: "ihnen", gen: "ihrer"  },
  { sub: "Sie",  acc: "Sie",  dat: "Ihnen", gen: "Ihrer"  },
];

// Prepositions by case
// German example phrases stay literal; meanings/glosses come from the `cases`
// translation namespace via prepMeaning_<key> / prepGloss_<key>.
const PREPS_ACC = [
  { prep: "durch",   key: "durch",   de: "durch den Park" },
  { prep: "für",     key: "fuer",    de: "für den Mann" },
  { prep: "gegen",   key: "gegen",   de: "gegen die Wand" },
  { prep: "ohne",    key: "ohne",    de: "ohne einen Grund" },
  { prep: "um",      key: "um",      de: "um den Tisch" },
  { prep: "bis",     key: "bis",     de: "bis nächsten Montag" },
  { prep: "entlang", key: "entlang", de: "den Fluss entlang" },
];
const PREPS_DAT = [
  { prep: "aus",       key: "aus",       de: "aus dem Haus" },
  { prep: "bei",       key: "bei",       de: "bei der Arbeit" },
  { prep: "mit",       key: "mit",       de: "mit dem Bus" },
  { prep: "nach",      key: "nach",      de: "nach der Schule" },
  { prep: "seit",      key: "seit",      de: "seit einem Jahr" },
  { prep: "von",       key: "von",       de: "von der Stadt" },
  { prep: "zu",        key: "zu",        de: "zum Arzt" },
  { prep: "außer",     key: "ausser",    de: "außer mir" },
  { prep: "gegenüber", key: "gegenueber",de: "dem Bahnhof gegenüber" },
  { prep: "ab",        key: "ab",        de: "ab dem ersten Januar" },
];
const PREPS_GEN = [
  { prep: "wegen",         key: "wegen",      de: "wegen des Wetters" },
  { prep: "trotz",         key: "trotz",      de: "trotz des Regens" },
  { prep: "während",       key: "waehrend",   de: "während der Pause" },
  { prep: "statt/anstatt", key: "statt",      de: "statt des Busses" },
  { prep: "aufgrund",      key: "aufgrund",   de: "aufgrund der Kosten" },
  { prep: "innerhalb",     key: "innerhalb",  de: "innerhalb der Stadt" },
  { prep: "außerhalb",     key: "ausserhalb", de: "außerhalb des Zentrums" },
  { prep: "mithilfe",      key: "mithilfe",   de: "mithilfe des Lehrers" },
];
const PREPS_TWOWAYS = [
  { prep: "an",      acc_ex: "ans Fenster (wohin? → Akk.)",  dat_ex: "am Fenster (wo? → Dat.)" },
  { prep: "auf",     acc_ex: "auf den Tisch legen",          dat_ex: "auf dem Tisch liegen" },
  { prep: "hinter",  acc_ex: "hinter das Haus gehen",        dat_ex: "hinter dem Haus stehen" },
  { prep: "in",      acc_ex: "in die Küche gehen",           dat_ex: "in der Küche sein" },
  { prep: "neben",   acc_ex: "neben den Stuhl stellen",      dat_ex: "neben dem Stuhl stehen" },
  { prep: "über",    acc_ex: "über die Brücke fahren",       dat_ex: "über der Stadt fliegen" },
  { prep: "unter",   acc_ex: "unter den Tisch legen",        dat_ex: "unter dem Tisch liegen" },
  { prep: "vor",     acc_ex: "vor das Haus gehen",           dat_ex: "vor dem Haus stehen" },
  { prep: "zwischen",acc_ex: "zwischen die Bücher stellen",  dat_ex: "zwischen den Büchern stehen" },
];

// ── Components ────────────────────────────────────────────────────────────────

function CaseTag({ cas }: { cas: string }) {
  const t = useTranslations("cases");
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
      {t(`case_${cas}`)}
    </span>
  );
}

function ArticleTable({
  title, data, footnote,
}: { title: string; data: Record<string, Record<string, string>>; footnote?: string }) {
  const t = useTranslations("cases");
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold w-32">{t("colCase")}</th>
              {GENDERS.map((g) => (
                <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{t(`gender_${g}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((cas) => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map((g) => (
                  <td key={g} className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-100">
                    {data[cas][g]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 italic">{footnote}</p>}
    </div>
  );
}

function AdjTable({ title, data, subtitle }: { title: string; subtitle: string; data: Record<string, Record<string, string>> }) {
  const t = useTranslations("cases");
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{subtitle}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold w-32">{t("colCase")}</th>
              {GENDERS.map((g) => (
                <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{t(`gender_${g}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((cas) => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map((g) => (
                  <td key={g} className="px-3 py-2 text-center font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {data[cas][g]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Practice helpers & components ────────────────────────────────────────────

function normalizePractice(s: string): string {
  return s.trim().toLowerCase().replace(/^-/, "");
}

type PracticeMode =
  | "definite" | "indefinite" | "negative"
  | "adj_weak" | "adj_mixed" | "adj_strong"
  | "pronouns";

const PRACTICE_OPTIONS: { id: PracticeMode; color: string }[] = [
  { id: "definite",   color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" },
  { id: "indefinite", color: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800" },
  { id: "negative",   color: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800" },
  { id: "adj_weak",   color: "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800" },
  { id: "adj_mixed",  color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" },
  { id: "adj_strong", color: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" },
  { id: "pronouns",   color: "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800" },
];

const FILL_CONFIGS: Partial<Record<PracticeMode, {
  hint: string;
  data: Record<string, Record<string, string>>; mono: boolean;
}>> = {
  definite:  { hint: "der · die · das · den · dem · des",                data: DEFINITE,   mono: false },
  indefinite:{ hint: "ein · eine · einem · einer · einen · eines",       data: INDEFINITE, mono: false },
  negative:  { hint: "kein · keine · keinem · keiner · keinen · keines", data: NEGATIVE,   mono: false },
  adj_weak:  { hint: "-e · -en",                                         data: ADJ_WEAK,   mono: true  },
  adj_mixed: { hint: "-e · -en · -er · -es",                             data: ADJ_MIXED,  mono: true  },
  adj_strong:{ hint: "-e · -en · -em · -er · -es",                       data: ADJ_STRONG, mono: true  },
};

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("cases");
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 mb-5 transition-colors"
    >
      <ChevronLeft size={16} className="rtl:-scale-x-100" />
      {t("backToPracticeMenu")}
    </button>
  );
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const t = useTranslations("cases");
  const pct = Math.round((score / total) * 100);
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
      score === total
        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
        : pct >= 60
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
    }`}>
      {score === total ? t("perfect") : pct >= 60 ? t("goodWork") : t("keepPractising")}&nbsp;
      {t("scoreCorrect", { score, total, pct })}
    </div>
  );
}

function FillTable({
  title, subtitle, hint, data, mono, onBack,
}: {
  title: string; subtitle: string; hint: string;
  data: Record<string, Record<string, string>>; mono?: boolean;
  onBack: () => void;
}) {
  const t = useTranslations("cases");
  const initAnswers = () =>
    Object.fromEntries(CASES.map(c => [c, Object.fromEntries(GENDERS.map(g => [g, ""]))]));

  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>(initAnswers);
  const [checked, setChecked] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isLocked = (v: string) => v === "—";

  const activeCells = CASES.reduce((s, c) =>
    s + GENDERS.reduce((ss, g) => ss + (isLocked(data[c][g]) ? 0 : 1), 0), 0);

  const score = checked
    ? CASES.reduce((s, c) =>
        s + GENDERS.reduce((ss, g) =>
          ss + (!isLocked(data[c][g]) && normalizePractice(answers[c][g]) === normalizePractice(data[c][g]) ? 1 : 0), 0), 0)
    : 0;

  const handleReset = () => { setAnswers(initAnswers()); setChecked(false); setShowAll(false); };

  const setCell = useCallback((cas: string, g: string, val: string) =>
    setAnswers(prev => ({ ...prev, [cas]: { ...prev[cas], [g]: val } })), []);

  const inputCls = `w-full text-center text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent${mono ? " font-mono" : ""}`;

  return (
    <div>
      <BackButton onClick={onBack} />
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{t("possibleForms")} </span>
        <span className="font-mono" dir="ltr">{hint}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold w-28">{t("colCase")}</th>
              {GENDERS.map(g => (
                <th key={g} className="px-2 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{t(`gender_${g}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map(cas => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map(g => {
                  const correct = data[cas][g];
                  const val = answers[cas][g];
                  const locked = isLocked(correct);
                  const ok = !locked && normalizePractice(val) === normalizePractice(correct);

                  if (locked) return (
                    <td key={g} className="px-2 py-2 text-center text-slate-300 dark:text-slate-600 font-mono">—</td>
                  );
                  if (showAll) return (
                    <td key={g} className="px-2 py-2 text-center">
                      <span className={`text-sm font-semibold text-brand-600 dark:text-brand-400${mono ? " font-mono" : ""}`}>{correct}</span>
                    </td>
                  );
                  if (checked) return (
                    <td key={g} className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-semibold${mono ? " font-mono" : ""} ${ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400 line-through"}`}>
                          {val || "—"}
                        </span>
                        {!ok && <span className={`text-xs font-bold text-green-600 dark:text-green-400${mono ? " font-mono" : ""}`}>{correct}</span>}
                        {ok ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                      </div>
                    </td>
                  );
                  return (
                    <td key={g} className="px-2 py-2">
                      <input type="text" value={val} onChange={e => setCell(cas, g, e.target.value)}
                        className={inputCls} placeholder="?" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!checked ? (
        <div className="flex gap-3">
          <button onClick={() => setChecked(true)} className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            {t("checkAnswers")}
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw size={14} /> {t("reset")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ScoreBar score={score} total={activeCells} />
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
              <RotateCcw size={14} /> {t("tryAgain")}
            </button>
            {!showAll && (
              <button onClick={() => setShowAll(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Eye size={14} /> {t("showAllAnswers")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PRONOUNS_PRACTICE_ROWS = [
  { labelKey: "p1sg",   sub: "ich",  acc: "mich", dat: "mir"   },
  { labelKey: "p2sg",   sub: "du",   acc: "dich", dat: "dir"   },
  { labelKey: "p3sgm",  sub: "er",   acc: "ihn",  dat: "ihm"   },
  { labelKey: "p3sgf",  sub: "sie",  acc: "sie",  dat: "ihr"   },
  { labelKey: "p3sgn",  sub: "es",   acc: "es",   dat: "ihm"   },
  { labelKey: "p1pl",   sub: "wir",  acc: "uns",  dat: "uns"   },
  { labelKey: "p2pl",   sub: "ihr",  acc: "euch", dat: "euch"  },
  { labelKey: "p3pl",   sub: "sie",  acc: "sie",  dat: "ihnen" },
  { labelKey: "formal", sub: "Sie",  acc: "Sie",  dat: "Ihnen" },
];

type PronCol = "acc" | "dat";
const PRON_COLS: PronCol[] = ["acc", "dat"];

function PronounsFill({ onBack }: { onBack: () => void }) {
  const t = useTranslations("cases");
  const initAnswers = () =>
    Object.fromEntries(PRONOUNS_PRACTICE_ROWS.map((_, i) => [i, { acc: "", dat: "" }]));

  const [answers, setAnswers] = useState<Record<number, Record<PronCol, string>>>(initAnswers);
  const [checked, setChecked] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const total = PRONOUNS_PRACTICE_ROWS.length * PRON_COLS.length;
  const score = checked
    ? PRONOUNS_PRACTICE_ROWS.reduce((s, row, i) =>
        s + PRON_COLS.reduce((ss, col) =>
          ss + (normalizePractice(answers[i][col]) === normalizePractice(row[col]) ? 1 : 0), 0), 0)
    : 0;

  const handleReset = () => { setAnswers(initAnswers()); setChecked(false); setShowAll(false); };

  const setCell = useCallback((idx: number, col: PronCol, val: string) =>
    setAnswers(prev => ({ ...prev, [idx]: { ...prev[idx], [col]: val } })), []);

  const COL_HEAD: Record<PronCol, string> = { acc: t("case_Accusative"), dat: t("case_Dative") };
  const COL_HEADER_CLS: Record<PronCol, string> = { acc: CASE_HEADER["Accusative"], dat: CASE_HEADER["Dative"] };
  const COL_OK_CLS: Record<PronCol, string> = {
    acc: "text-red-700 dark:text-red-400",
    dat: "text-green-700 dark:text-green-400",
  };

  const inputCls = "w-full text-center text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent";

  return (
    <div>
      <BackButton onClick={onBack} />
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{t("practice_pronouns_title")}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("fillAccDat")}</p>
      </div>
      <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{t("possibleForms")} </span>
        <span className="font-mono" dir="ltr">mich · mir · dich · dir · ihn · ihm · sie · ihr · es · uns · euch · sie · ihnen · Sie · Ihnen</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold w-24 bg-slate-50 dark:bg-slate-800">{t("person")}</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Nominative"]}`}>{t("nomGiven")}</th>
              {PRON_COLS.map(col => (
                <th key={col} className={`px-3 py-2 text-center text-xs font-semibold ${COL_HEADER_CLS[col]}`}>{COL_HEAD[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRONOUNS_PRACTICE_ROWS.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{t(`personLabel_${row.labelKey}`)}</td>
                <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400">{row.sub}</td>
                {PRON_COLS.map(col => {
                  const correct = row[col];
                  const val = answers[i][col];
                  const ok = normalizePractice(val) === normalizePractice(correct);

                  if (showAll) return (
                    <td key={col} className="px-3 py-2 text-center">
                      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{correct}</span>
                    </td>
                  );
                  if (checked) return (
                    <td key={col} className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-semibold ${ok ? COL_OK_CLS[col] : "text-red-600 dark:text-red-400 line-through"}`}>{val || "—"}</span>
                        {!ok && <span className={`text-xs font-bold ${COL_OK_CLS[col]}`}>{correct}</span>}
                        {ok ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                      </div>
                    </td>
                  );
                  return (
                    <td key={col} className="px-2 py-1.5">
                      <input type="text" value={val} onChange={e => setCell(i, col, e.target.value)}
                        className={inputCls} placeholder="?" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!checked ? (
        <div className="flex gap-3">
          <button onClick={() => setChecked(true)} className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            {t("checkAnswers")}
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw size={14} /> {t("reset")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ScoreBar score={score} total={total} />
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
              <RotateCcw size={14} /> {t("tryAgain")}
            </button>
            {!showAll && (
              <button onClick={() => setShowAll(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Eye size={14} /> {t("showAllAnswers")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const t = useTranslations("cases");
  const [tab, setTab] = useState<CasesTab>("articles");
  const [practiceMode, setPracticeMode] = useState<PracticeMode | null>(null);

  const innerTabs: { id: CasesTab; label: string }[] = [
    { id: "articles",     label: t("tab_articles") },
    { id: "adjectives",   label: t("tab_adjectives") },
    { id: "prepositions", label: t("tab_prepositions") },
    { id: "pronouns",     label: t("tab_pronouns") },
    { id: "tips",         label: t("tab_tips") },
    { id: "practice",     label: t("tab_practice") },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("subtitle")}
        </p>
        {/* Case legend */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {CASES.map((c) => (
            <span key={c} className={`text-xs font-semibold px-3 py-1 rounded-full border ${CASE_COLORS[c]}`}>
              {t(`case_${c}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {innerTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Articles tab ── */}
      {tab === "articles" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">{t("whenToUse")}</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {CASES.map((cas) => (
                <div key={cas} className={`p-3 rounded-xl border ${CASE_COLORS[cas]}`}>
                  <p className="font-bold text-sm">{t(`case_${cas}`)}</p>
                  <p className="text-xs mt-0.5 opacity-80">{t(`usage_${cas}_use`)}</p>
                  <p className="text-xs mt-1 font-mono opacity-90">{t(`usage_${cas}_ex`)}</p>
                </div>
              ))}
            </div>
          </div>

          <ArticleTable
            title={t("defArticlesTitle")}
            data={DEFINITE}
            footnote={t("defArticlesFootnote")}
          />
          <ArticleTable
            title={t("indefArticlesTitle")}
            data={INDEFINITE}
            footnote={t("indefArticlesFootnote")}
          />
          <ArticleTable
            title={t("negArticlesTitle")}
            data={NEGATIVE}
            footnote={t("negArticlesFootnote")}
          />

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-200 mb-2">{t("keyChangesTitle")}</p>
            <ul className="space-y-1 text-amber-700 dark:text-amber-300 text-xs">
              {(t.raw("keyChanges") as { label: string; text: string }[]).map(({ label, text }, i) => (
                <li key={i}><span className="font-mono font-bold">{label}</span> <span dir="ltr">{text}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Adjectives tab ── */}
      {tab === "adjectives" && (
        <div className="space-y-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("adjIntro")}
          </p>

          <AdjTable
            title={t("weakTitle")}
            subtitle={t("weakSubtitle")}
            data={ADJ_WEAK}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ms-1 italic">
            {t("exampleLabel")} <span className="font-mono" dir="ltr">der alte Mann · die alte Frau · das alte Haus · die alten Leute</span>
          </div>

          <AdjTable
            title={t("mixedTitle")}
            subtitle={t("mixedSubtitle")}
            data={ADJ_MIXED}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ms-1 italic">
            {t("exampleLabel")} <span className="font-mono" dir="ltr">ein alter Mann · eine alte Frau · ein altes Haus · keine alten Leute</span>
          </div>

          <AdjTable
            title={t("strongTitle")}
            subtitle={t("strongSubtitle")}
            data={ADJ_STRONG}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ms-1 italic">
            {t("exampleLabel")} <span className="font-mono" dir="ltr">kalter Kaffee · frische Milch · gutes Brot · alte Menschen</span>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-sm">
            <p className="font-bold text-blue-800 dark:text-blue-300 mb-2">{t("patternTrickTitle")}</p>
            <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
              {t.rich("patternTrickBody", {
                strong: (c) => <strong>{c}</strong>,
                em: (c) => <em>{c}</em>,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ── Prepositions tab ── */}
      {tab === "prepositions" && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-bold px-3 py-1 rounded-full border ${CASE_COLORS["Accusative"]}`}>{t("accOnly")}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t("accOnlyDesc")}</span>
            </div>
            <div className="space-y-2">
              {PREPS_ACC.map(({ prep, key, de }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-sm">
                  <span className="font-bold text-red-700 dark:text-red-300 w-20 shrink-0" dir="ltr" lang="de">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-36 shrink-0 text-xs">{t(`prepMeaning_${key}`)}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic"><span dir="ltr" lang="de">{de}</span> — {t(`prepGloss_${key}`)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
              {t.rich("mnemonicAcc", { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-bold px-3 py-1 rounded-full border ${CASE_COLORS["Dative"]}`}>{t("datOnly")}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t("datOnlyDesc")}</span>
            </div>
            <div className="space-y-2">
              {PREPS_DAT.map(({ prep, key, de }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-xl text-sm">
                  <span className="font-bold text-green-700 dark:text-green-300 w-20 shrink-0" dir="ltr" lang="de">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-36 shrink-0 text-xs">{t(`prepMeaning_${key}`)}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic"><span dir="ltr" lang="de">{de}</span> — {t(`prepGloss_${key}`)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
              {t.rich("mnemonicDat", { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold px-3 py-1 rounded-full border bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900/40">{t("genOnly")}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t("genOnlyDesc")}</span>
            </div>
            <div className="space-y-2">
              {PREPS_GEN.map(({ prep, key, de }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 rounded-xl text-sm">
                  <span className="font-bold text-purple-700 dark:text-purple-300 w-28 shrink-0" dir="ltr" lang="de">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-32 shrink-0 text-xs">{t(`prepMeaning_${key}`)}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic"><span dir="ltr" lang="de">{de}</span> — {t(`prepGloss_${key}`)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">{t("genSpokenNote")}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS["Accusative"]}`}>{t("accAbbr")}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{t("orWord")}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS["Dative"]}`}>{t("datAbbr")}</span>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("twoWayTitle")}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {t.rich("twoWayRule", { strong: (c) => <strong>{c}</strong> })}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-start font-semibold text-slate-600 dark:text-slate-300 w-20">{t("twoWayColPrep")}</th>
                    <th className="px-3 py-2 text-start font-semibold text-red-600 dark:text-red-400">{t("twoWayColAcc")}</th>
                    <th className="px-3 py-2 text-start font-semibold text-green-600 dark:text-green-400">{t("twoWayColDat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {PREPS_TWOWAYS.map(({ prep, acc_ex, dat_ex }) => (
                    <tr key={prep} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200" dir="ltr" lang="de">{prep}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 italic" dir="ltr" lang="de">{acc_ex}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 italic" dir="ltr" lang="de">{dat_ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Pronouns tab ── */}
      {tab === "pronouns" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">{t("personalPronounsTitle")}</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("person")}</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Nominative"]}`}>{t("colNomSubject")}</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Accusative"]}`}>{t("colAccObj")}</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Dative"]}`}>{t("colDatObj")}</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold bg-slate-400 text-white">{t("colGenRare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { labelKey: "p1sg",   sub: "ich",  acc: "mich", dat: "mir",   gen: "meiner" },
                    { labelKey: "p2sg",   sub: "du",   acc: "dich", dat: "dir",   gen: "deiner" },
                    { labelKey: "p3sgm",  sub: "er",   acc: "ihn",  dat: "ihm",   gen: "seiner" },
                    { labelKey: "p3sgf",  sub: "sie",  acc: "sie",  dat: "ihr",   gen: "ihrer"  },
                    { labelKey: "p3sgn",  sub: "es",   acc: "es",   dat: "ihm",   gen: "seiner" },
                    { labelKey: "p1pl",   sub: "wir",  acc: "uns",  dat: "uns",   gen: "unser"  },
                    { labelKey: "p2pl",   sub: "ihr",  acc: "euch", dat: "euch",  gen: "euer"   },
                    { labelKey: "p3pl",   sub: "sie",  acc: "sie",  dat: "ihnen", gen: "ihrer"  },
                    { labelKey: "formal", sub: "Sie",  acc: "Sie",  dat: "Ihnen", gen: "Ihrer"  },
                  ].map(({ labelKey, sub, acc, dat, gen }) => (
                    <tr key={labelKey} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{t(`personLabel_${labelKey}`)}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400">{sub}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-700 dark:text-red-400">{acc}</td>
                      <td className="px-3 py-2 text-center font-bold text-green-700 dark:text-green-400">{dat}</td>
                      <td className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 text-xs">{gen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">{t("possessiveTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {t.rich("possessiveNote", { strong: (c) => <strong>{c}</strong> })}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-start text-slate-500 dark:text-slate-400 font-semibold">{t("colPronoun")}</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">{t("colMeaning")}</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">{t("colMascNom")}</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">{t("colFemNom")}</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">{t("colNeutNom")}</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">{t("colPluralNom")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { pro: "mein-",  key: "mein",  m: "mein",  f: "meine",  n: "mein",  pl: "meine" },
                    { pro: "dein-",  key: "dein",  m: "dein",  f: "deine",  n: "dein",  pl: "deine" },
                    { pro: "sein-",  key: "sein",  m: "sein",  f: "seine",  n: "sein",  pl: "seine" },
                    { pro: "ihr-",   key: "ihr",   m: "ihr",   f: "ihre",   n: "ihr",   pl: "ihre"  },
                    { pro: "unser-", key: "unser", m: "unser", f: "unsere", n: "unser", pl: "unsere"},
                    { pro: "euer-",  key: "euer",  m: "euer",  f: "eure",   n: "euer",  pl: "eure"  },
                    { pro: "Ihr-",   key: "IhrF",  m: "Ihr",   f: "Ihre",   n: "Ihr",   pl: "Ihre"  },
                  ].map(({ pro, key, m, f, n, pl }) => (
                    <tr key={pro} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200" dir="ltr" lang="de">{pro}</td>
                      <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">{t(`possMeaning_${key}`)}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{m}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{f}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{n}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{pl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">{t("relativeTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t("relativeNote")}</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-start text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("colCase")}</th>
                    {GENDERS.map((g) => <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{t(`gender_${g}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cas: "Nominative", m: "der",    f: "die",   n: "das",   pl: "die" },
                    { cas: "Accusative", m: "den",    f: "die",   n: "das",   pl: "die" },
                    { cas: "Dative",     m: "dem",    f: "der",   n: "dem",   pl: "denen" },
                    { cas: "Genitive",   m: "dessen", f: "deren", n: "dessen", pl: "deren" },
                  ].map(({ cas, m, f, n, pl }) => (
                    <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                          {cas.slice(0,4).toUpperCase()}
                        </span>
                      </td>
                      {[m, f, n, pl].map((v, i) => (
                        <td key={i} className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-100">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 italic">
              {t.rich("relativeFootnote", { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>
        </div>
      )}

      {/* ── Practice tab ── */}
      {tab === "practice" && (
        <div>
          {!practiceMode ? (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                {t.rich("practiceIntro", {
                  mono: (c) => <span className="font-mono" dir="ltr">{c}</span>,
                })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRACTICE_OPTIONS.map(({ id, color }) => (
                  <button
                    key={id}
                    onClick={() => setPracticeMode(id)}
                    className={`p-4 rounded-xl border-2 text-start hover:scale-[1.01] active:scale-[0.99] transition-all ${color}`}
                  >
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{t(`practice_${id}_title`)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t(`practice_${id}_sub`)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : practiceMode === "pronouns" ? (
            <PronounsFill onBack={() => setPracticeMode(null)} />
          ) : (
            (() => {
              const cfg = FILL_CONFIGS[practiceMode];
              if (!cfg) return null;
              return (
                <FillTable
                  key={practiceMode}
                  title={t(`practice_${practiceMode}_title`)}
                  subtitle={t(`practice_${practiceMode}_subtitle`)}
                  hint={cfg.hint}
                  data={cfg.data}
                  mono={cfg.mono}
                  onBack={() => setPracticeMode(null)}
                />
              );
            })()
          )}
        </div>
      )}

      {/* ── Tips tab ── */}
      {tab === "tips" && (
        <div className="space-y-5">
          {[
            {
              key: "derword",
              color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40",
              titleColor: "text-blue-800 dark:text-blue-300",
            },
            {
              key: "accusative",
              color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40",
              titleColor: "text-red-800 dark:text-red-300",
            },
            {
              key: "dative",
              color: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40",
              titleColor: "text-green-800 dark:text-green-300",
            },
            {
              key: "genitive",
              color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/40",
              titleColor: "text-purple-800 dark:text-purple-300",
            },
            {
              key: "prepositions",
              color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40",
              titleColor: "text-amber-800 dark:text-amber-200",
            },
            {
              key: "gender",
              color: "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
              titleColor: "text-slate-700 dark:text-slate-200",
            },
          ].map(({ key, color, titleColor }) => (
            <div key={key} className={`p-4 rounded-xl border ${color}`}>
              <p className={`font-bold text-sm mb-2 ${titleColor}`}>{t(`tipsTitle_${key}`)}</p>
              <ul className="space-y-1">
                {(t.raw(`tips_${key}`) as string[]).map((tip, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                    <span className="text-slate-400 dark:text-slate-500">•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
