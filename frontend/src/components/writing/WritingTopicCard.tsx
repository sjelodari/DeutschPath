"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { Clock, FileText, GraduationCap } from "lucide-react";

interface WritingTopic {
  id: string;
  title: string;
  description: string;
  level: string;
  writing_type: string;
  exam: string | null;
  word_count_min: number;
  word_count_max: number;
  time_limit_min: number | null;
}

interface Props {
  topic: WritingTopic;
  selected: boolean;
  onClick: () => void;
}

const examColors: Record<string, string> = {
  Goethe:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  TestDaF: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DSH:     "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  TELC:    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  OeSD:    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

function getExamColor(exam: string): string {
  const key = Object.keys(examColors).find(k => exam.startsWith(k));
  return key ? examColors[key] : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function WritingTopicCard({ topic, selected, onClick }: Props) {
  const t = useTranslations("writing");
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-start p-3 rounded-lg border transition-all duration-150",
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-400"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
      )}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <LevelBadge level={topic.level} size="sm" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight flex-1" dir="ltr" lang="de">
          {topic.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <FileText size={11} />
          {topic.writing_type}
        </span>

        <span className="text-xs text-slate-300 dark:text-slate-600">·</span>

        <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
          {t("wordRange", { min: topic.word_count_min, max: topic.word_count_max })}
        </span>

        {topic.time_limit_min && (
          <>
            <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
              <Clock size={11} />
              {t("minutes", { count: topic.time_limit_min })}
            </span>
          </>
        )}

        {topic.exam && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ms-auto",
              getExamColor(topic.exam)
            )}
          >
            <GraduationCap size={10} />
            {topic.exam}
          </span>
        )}
      </div>
    </button>
  );
}
