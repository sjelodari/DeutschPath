"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getStats, getProfile, updateProfile } from "@/src/lib/api";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { useAppStore } from "@/src/lib/store";
import {
  BookOpen, Layers, BookMarked, MessageSquare, TrendingUp,
  PenLine, Flame, Target,
} from "lucide-react";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { userLevel, setUserLevel } = useAppStore();
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getProfile()])
      .then(([s, p]) => { setStats(s); setProfile(p); })
      .finally(() => setLoading(false));
  }, []);

  const handleLevelChange = async (level: string) => {
    setUserLevel(level);
    try { await updateProfile({ current_level: level }); } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const wordsByLevel = stats?.words?.by_level ?? {};
  const wordsByType  = stats?.words?.by_type  ?? {};
  const dailyGoal    = profile?.daily_goal_words ?? 0;
  const wordsToday   = stats?.words?.today ?? 0;
  const goalPct      = dailyGoal > 0 ? Math.min(100, Math.round((wordsToday / dailyGoal) * 100)) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h1>
          {(profile?.streak_days ?? 0) > 0 && (
            <span className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-orange-500 dark:text-orange-400">
              <Flame size={13} /> {t("dayStreak", { days: profile.streak_days })}
            </span>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t("yourLevel")}</p>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => handleLevelChange(l)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  userLevel === l
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Daily goal progress — only shown when a goal is set */}
      {dailyGoal > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-orange-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("todaysGoal")}</span>
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {wordsToday}
              <span className="font-normal text-slate-400 dark:text-slate-500"> / {t("goalWords", { count: dailyGoal })}</span>
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all ${goalPct >= 100 ? "bg-emerald-500" : "bg-orange-400"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          {goalPct >= 100 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
              {t("goalReached")}
            </p>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Layers size={18} className="text-brand-600" />}
          label={t("wordsSaved")}
          value={stats?.words?.total ?? 0}
          sub={
            (stats?.words?.due ?? 0) > 0
              ? t("dueForReview", { count: stats.words.due })
              : t("mastered", { count: stats?.words?.mastered ?? 0 })
          }
          color="bg-brand-50 dark:bg-brand-900/20"
          highlight={(stats?.words?.due ?? 0) > 0}
        />
        <StatCard
          icon={<BookMarked size={18} className="text-indigo-600" />}
          label={t("grammarRules")}
          value={stats?.grammar?.total_rules_seen ?? 0}
          sub={t("mastered", { count: stats?.grammar?.mastered ?? 0 })}
          color="bg-indigo-50 dark:bg-indigo-900/20"
        />
        <StatCard
          icon={<MessageSquare size={18} className="text-green-600" />}
          label={t("conversations")}
          value={stats?.scenarios?.total_sessions ?? 0}
          sub={
            (stats?.scenarios?.completed ?? 0) > 0
              ? t("completed", { count: stats.scenarios.completed })
              : t("keepPracticing")
          }
          color="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          icon={<PenLine size={18} className="text-purple-600" />}
          label={t("writingSessions")}
          value={stats?.writing?.total_sessions ?? 0}
          sub={
            (stats?.writing?.avg_score ?? 0) > 0
              ? t("avgScore", { score: stats.writing.avg_score })
              : t("startWriting")
          }
          color="bg-purple-50 dark:bg-purple-900/20"
        />
      </div>

      {/* Vocabulary charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp size={15} /> {t("vocabByLevel")}
          </h2>
          {(stats?.words?.total ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t("noVocabYet")}</p>
          ) : (
            <div className="space-y-2.5">
              {LEVELS.map((level) => {
                const count = wordsByLevel[level] ?? 0;
                const total = stats?.words?.total || 1;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <LevelBadge level={level} />
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <div
                        className="h-2 bg-brand-500 rounded-full transition-all"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-6 text-end tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{t("vocabByType")}</h2>
          {Object.keys(wordsByType).length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t("noVocabYet")}</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(wordsByType).map(([type, count]: any) => {
                const total = stats?.words?.total || 1;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-20 capitalize">{type}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <div
                        className="h-2 bg-indigo-400 rounded-full transition-all"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-6 text-end tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Books library */}
      {(stats?.books?.titles?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{t("booksInLibrary")}</h2>
          <div className="flex flex-wrap gap-2">
            {stats.books.titles.map((title: string, i: number) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <BookOpen size={13} className="text-slate-400 dark:text-slate-500" />
                {title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${color} rounded-2xl p-5`}>
      <div className="mb-3">{icon}</div>
      <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
      <p
        className={`text-xs mt-0.5 truncate ${
          highlight ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}
