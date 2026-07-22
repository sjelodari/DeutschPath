"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, Layers, BookMarked, MessageSquare, BarChart2,
  Settings, Table2, Sun, Moon, User, Power, PenLine,
} from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/src/lib/store";
import { ConfirmLeaveDialog } from "./ConfirmLeaveDialog";
import { useTheme } from "@/src/hooks/useTheme";
import { getSettings, shutdownServer } from "@/src/lib/api";

const tabs = [
  { href: "/reader",     labelKey: "reader",     icon: BookOpen },
  { href: "/vocabulary", labelKey: "vocabulary", icon: Layers },
  { href: "/grammar",    labelKey: "grammar",    icon: BookMarked },
  { href: "/cases",      labelKey: "cases",      icon: Table2 },
  { href: "/scenarios",  labelKey: "scenarios",  icon: MessageSquare },
  { href: "/writing",    labelKey: "writing",    icon: PenLine },
  { href: "/dashboard",  labelKey: "dashboard",  icon: BarChart2 },
  { href: "/settings",   labelKey: "settings",   icon: Settings },
  { href: "/contact",    labelKey: "contact",    icon: User },
] as const;

type BackendStatus = "online" | "offline" | "checking";
type ShutdownState = "idle" | "shutting-down" | "stopped";

export function TabNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { hasPendingChat, setHasPendingChat } = useAppStore();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { theme, toggle } = useTheme();

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [showShutdownDialog, setShowShutdownDialog] = useState(false);
  const [shutdownState, setShutdownState] = useState<ShutdownState>("idle");

  // Poll backend status every 30 s
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await getSettings();
        if (!cancelled) setBackendStatus("online");
      } catch {
        if (!cancelled) setBackendStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const navigate = (href: string) => {
    if (pathname.startsWith(href)) return;
    if (hasPendingChat) {
      setPendingHref(href);
    } else {
      router.push(href);
    }
  };

  const handleConfirm = () => {
    if (!pendingHref) return;
    setHasPendingChat(false);
    router.push(pendingHref);
    setPendingHref(null);
  };

  const handleShutdown = async () => {
    setShowShutdownDialog(false);
    setShutdownState("shutting-down");
    setBackendStatus("offline");
    await shutdownServer();
    setShutdownState("stopped");
  };

  const statusDot: Record<BackendStatus, string> = {
    online:   "bg-green-500",
    offline:  "bg-red-500",
    checking: "bg-yellow-400 animate-pulse",
  };
  const statusLabel: Record<BackendStatus, string> = {
    online:   t("backendOnline"),
    offline:  t("backendOffline"),
    checking: t("backendChecking"),
  };

  return (
    <>
      {/* ── Nav bar ── */}
      {pendingHref && (
        <ConfirmLeaveDialog onConfirm={handleConfirm} onCancel={() => setPendingHref(null)} />
      )}
      <nav className="fixed top-0 inset-x-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 flex items-center px-4 gap-1 transition-colors">

        {/* Brand + status dot */}
        <div className="flex items-center gap-2 me-4 shrink-0">
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-red-600 to-yellow-500 dark:from-slate-100 dark:via-red-400 dark:to-yellow-400 bg-clip-text text-transparent select-none">
            DeutschPath
          </span>
          <span
            className={clsx("w-2 h-2 rounded-full shrink-0", statusDot[backendStatus])}
            title={statusLabel[backendStatus]}
          />
        </div>

        {/* Tab links */}
        <div className="flex gap-1 overflow-x-auto flex-1">
          {tabs.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon size={16} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
          className="ms-2 p-2 rounded-lg text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Turn Off button */}
        <button
          onClick={() => setShowShutdownDialog(true)}
          title={t("turnOffTitle")}
          className="ms-1 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
        >
          <Power size={16} />
        </button>
      </nav>

      {/* ── Shutdown confirmation dialog ── */}
      {showShutdownDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-80 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <Power size={16} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t("shutdownHeading")}
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {t.rich("shutdownBody", { strong: (c) => <strong>{c}</strong> })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowShutdownDialog(false)}
                className="flex-1 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleShutdown}
                className="flex-1 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                {t("turnOff")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shutdown / stopped overlay ── */}
      {shutdownState !== "idle" && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
          <div className="text-center px-6">
            {shutdownState === "shutting-down" ? (
              <>
                <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-red-500 animate-spin mx-auto mb-5" />
                <h1 className="text-2xl font-bold text-white mb-2">{t("shuttingDown")}</h1>
                <p className="text-slate-400 text-sm">{t("stoppingServers")}</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-5">
                  <Power size={24} className="text-slate-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{t("stopped")}</h1>
                <p className="text-slate-400 text-sm">
                  {t.rich("restartHint", { strong: (c) => <strong className="text-slate-300">{c}</strong> })}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
