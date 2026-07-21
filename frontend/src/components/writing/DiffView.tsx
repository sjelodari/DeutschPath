"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

type DiffOp = { type: "equal" | "delete" | "insert"; text: string };

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(t => t.length > 0);
}

function computeDiff(
  original: string,
  corrected: string,
): { orig: DiffOp[]; corr: DiffOp[] } {
  const a = tokenize(original);
  const b = tokenize(corrected);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const origOps: DiffOp[] = [];
  const corrOps: DiffOp[] = [];
  let i = m, j = n;
  const raw: Array<{ type: "equal" | "delete" | "insert"; orig?: string; corr?: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ type: "equal", orig: a[i - 1], corr: b[j - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "insert", corr: b[j - 1] }); j--;
    } else {
      raw.push({ type: "delete", orig: a[i - 1] }); i--;
    }
  }
  raw.reverse();

  for (const op of raw) {
    if (op.type === "equal") {
      origOps.push({ type: "equal", text: op.orig! });
      corrOps.push({ type: "equal", text: op.corr! });
    } else if (op.type === "delete") {
      origOps.push({ type: "delete", text: op.orig! });
    } else {
      corrOps.push({ type: "insert", text: op.corr! });
    }
  }

  return { orig: origOps, corr: corrOps };
}

interface DiffViewProps {
  originalText: string;
  correctedText: string;
}

export function DiffView({ originalText, correctedText }: DiffViewProps) {
  const t = useTranslations("diffView");
  const { orig, corr } = useMemo(
    () => computeDiff(originalText, correctedText),
    [originalText, correctedText],
  );

  const changes = orig.filter(o => o.type === "delete").length
    + corr.filter(o => o.type === "insert").length;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-600" />
          {t("legendErrors")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-600" />
          {t("legendImprovements")}
        </span>
        <span className="ms-auto">{t("changesCount", { count: changes })}</span>
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Left — original with errors marked */}
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
              {t("yourText")}
            </span>
          </div>
          <div className="p-4 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words" dir="ltr" lang="de">
            {orig.map((op, idx) =>
              op.type === "equal" ? (
                <span key={idx}>{op.text}</span>
              ) : (
                <mark
                  key={idx}
                  title={t("errorMark")}
                  className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-sm px-0.5 not-italic"
                >
                  {op.text}
                </mark>
              )
            )}
          </div>
        </div>

        {/* Right — improved version with changes marked */}
        <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800/50 flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
              {t("improvedVersion")}
            </span>
            <span className="ms-auto text-xs text-slate-400 dark:text-slate-500 normal-case italic font-normal">
              {t("highlightHint")}
            </span>
          </div>
          <div className="corrected-text select-text p-4 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words" dir="ltr" lang="de">
            {corr.map((op, idx) =>
              op.type === "equal" ? (
                <span key={idx}>{op.text}</span>
              ) : (
                <mark
                  key={idx}
                  title={t("improvementMark")}
                  className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 rounded-sm px-0.5 not-italic font-medium"
                >
                  {op.text}
                </mark>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
