"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAppStore } from "@/src/lib/store";
import { SUPPORTED_LANGUAGES } from "@/src/lib/languages";
import type { Language } from "@/src/lib/languages";
import { UI_LOCALES, UI_LOCALE_LABELS, type UiLocale } from "@/src/i18n/config";
import { applyUiLocaleCookie } from "@/src/lib/locale";
import { getSettings, saveSettings, deleteApiKey, getUsage, resetUsage, testApiConnection, getProfile, updateProfile } from "@/src/lib/api";
import { Key, Globe, BookOpen, Check, Eye, EyeOff, Save, Loader2, Lock, Trash2, AlertTriangle, RotateCcw, X, Activity, Zap, Info, Target, HardDrive, Download, Upload, Languages } from "lucide-react";
import { deleteAllVocab, resetWordStats, resetGrammarMastery, deleteAllScenarioSessions, deleteWritingSessions, backupDb, restoreDb } from "@/src/lib/api";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const ENGLISH = SUPPORTED_LANGUAGES.find((l) => l.code === "en")!;
const SECONDARY_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.code !== "en");

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const uiLocale = useLocale();
  const { userLevel, setUserLevel, translationLanguages, setTranslationLanguages } = useAppStore();

  // API key
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [keyIsSet, setKeyIsSet] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keyDeleting, setKeyDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  type TestState = "idle" | "testing" | "ok" | "error";
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");

  // UI language (app chrome) — persisted per-user in the backend
  const [uiLangSaving, setUiLangSaving] = useState(false);

  // Language state
  const currentSecondary = translationLanguages.find((l) => l.code !== "en");
  const [englishOn, setEnglishOn] = useState<boolean>(translationLanguages.some((l) => l.code === "en"));
  const [secondaryCode, setSecondaryCode] = useState<string>(currentSecondary?.code ?? "");
  const [langSaved, setLangSaved] = useState(false);

  // Usage stats
  const [usage, setUsage] = useState<any>(null);
  const [usageResetting, setUsageResetting] = useState(false);

  // Daily goal
  const [dailyGoal, setDailyGoal] = useState(10);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  // Backup / restore
  const [backingUp, setBackingUp] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreState, setRestoreState] = useState<"idle" | "confirming" | "loading" | "done" | "error">("idle");
  const [restoreError, setRestoreError] = useState("");

  // Danger zone
  type DangerState = "idle" | "confirming" | "loading" | "done";
  const [resetLearningsState, setResetLearningsState] = useState<DangerState>("idle");
  const [deleteVocabState, setDeleteVocabState] = useState<DangerState>("idle");
  const [dangerError, setDangerError] = useState("");

  useEffect(() => {
    getSettings()
      .then((d) => { setKeyIsSet(d.gemini_key_set); setMaskedKey(d.gemini_key_masked); })
      .catch(() => {});
    getUsage().then(setUsage).catch(() => {});
    getProfile().then((p) => { if (p.daily_goal_words) setDailyGoal(p.daily_goal_words); }).catch(() => {});
  }, []);

  const handleSaveKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setKeySaving(true);
    setKeyError("");
    try {
      await saveSettings({ gemini_api_key: trimmed });
      setKeyIsSet(true);
      setMaskedKey(trimmed.slice(0, 8) + "•".repeat(Math.max(0, trimmed.length - 12)) + trimmed.slice(-4));
      setApiKey("");
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
    } catch (e: any) {
      setKeyError(e.message || t("errors.saveKey"));
    } finally {
      setKeySaving(false);
    }
  };

  const handleTestKey = async () => {
    setTestState("testing");
    setTestError("");
    try {
      const keyToTest = apiKey.trim() || undefined;
      await testApiConnection(keyToTest);
      setTestState("ok");
      setTimeout(() => setTestState("idle"), 4000);
    } catch (e: any) {
      const msg = e.message || t("errors.connection");
      setTestError(msg.replace(/^API \d+: /, ""));
      setTestState("error");
      setTimeout(() => setTestState("idle"), 6000);
    }
  };

  const handleDeleteKey = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setKeyDeleting(true);
    setKeyError("");
    try {
      await deleteApiKey();
      setKeyIsSet(false);
      setMaskedKey("");
      setConfirmDelete(false);
    } catch (e: any) {
      setKeyError(e.message || t("errors.removeKey"));
    } finally {
      setKeyDeleting(false);
    }
  };

  const handleSelectUiLocale = async (code: UiLocale) => {
    if (code === uiLocale || uiLangSaving) return;
    setUiLangSaving(true);
    try {
      await updateProfile({ ui_language: code });
    } catch { /* still switch locally — cookie is the render source */ }
    applyUiLocaleCookie(code);
    router.refresh();
    setUiLangSaving(false);
  };

  const handleApplyLangs = () => {
    const langs: Language[] = [];
    if (englishOn) langs.push(ENGLISH as Language);
    if (secondaryCode) {
      const secondLang = SUPPORTED_LANGUAGES.find((l) => l.code === secondaryCode) as Language;
      if (secondLang) langs.push(secondLang);
    }
    if (langs.length === 0) return;
    setTranslationLanguages(langs);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2500);
  };

  const handleResetUsage = async () => {
    setUsageResetting(true);
    try {
      await resetUsage();
      const fresh = await getUsage();
      setUsage(fresh);
    } catch { /* silent */ } finally {
      setUsageResetting(false);
    }
  };

  const handleSaveGoal = async () => {
    setGoalSaving(true);
    try {
      await updateProfile({ daily_goal_words: dailyGoal });
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 2500);
    } catch { /* silent */ } finally {
      setGoalSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try { await backupDb(); } catch { /* silent */ } finally { setBackingUp(false); }
  };

  const handleRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRestoreFile(f);
    setRestoreState("confirming");
    setRestoreError("");
    e.target.value = "";
  };

  const handleRestoreConfirm = async () => {
    if (!restoreFile) return;
    setRestoreState("loading");
    setRestoreError("");
    try {
      await restoreDb(restoreFile);
      setRestoreState("done");
    } catch (e: any) {
      setRestoreError(e.message || t("errors.restore"));
      setRestoreState("error");
    } finally {
      setRestoreFile(null);
    }
  };

  const handleResetLearnings = async () => {
    if (resetLearningsState === "idle") { setResetLearningsState("confirming"); return; }
    if (resetLearningsState !== "confirming") return;
    setResetLearningsState("loading");
    setDangerError("");
    try {
      await Promise.all([resetGrammarMastery(), resetWordStats(), deleteAllScenarioSessions(), deleteWritingSessions()]);
      setResetLearningsState("done");
      setTimeout(() => setResetLearningsState("idle"), 3000);
    } catch {
      setDangerError(t("errors.reset"));
      setResetLearningsState("idle");
    }
  };

  const handleDeleteVocab = async () => {
    if (deleteVocabState === "idle") { setDeleteVocabState("confirming"); return; }
    if (deleteVocabState !== "confirming") return;
    setDeleteVocabState("loading");
    setDangerError("");
    try {
      await deleteAllVocab();
      setDeleteVocabState("done");
      setTimeout(() => setDeleteVocabState("idle"), 3000);
    } catch {
      setDangerError(t("errors.delete"));
      setDeleteVocabState("idle");
    }
  };

  const secondLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === secondaryCode);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* ── App Language (UI chrome) ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
            <Languages size={17} className="text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("uiLang.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("uiLang.desc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UI_LOCALES.map((code) => {
            const selected = uiLocale === code;
            return (
              <button
                key={code}
                onClick={() => handleSelectUiLocale(code)}
                disabled={uiLangSaving}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all disabled:opacity-60 ${
                  selected
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected ? "border-brand-500" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {selected && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${selected ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>
                    {t(`uiLang.names.${code}`)}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5" dir={code === "en" ? "ltr" : "rtl"}>
                    {UI_LOCALE_LABELS[code].nativeName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("uiLang.note")}</p>
      </section>

      {/* ── Gemini API Key ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <Key size={17} className="text-amber-600 dark:text-amber-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("apiKey.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("apiKey.desc")}{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 dark:text-brand-400 hover:underline"
              >
                {t("apiKey.getFreeKey")}
              </a>
            </p>
          </div>
        </div>

        {keyIsSet && maskedKey && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
            <Check size={14} className="shrink-0" />
            <span className="flex-1">
              {t("apiKey.currentKey")} <code className="font-mono" dir="ltr">{maskedKey}</code>
            </span>
            {confirmDelete ? (
              <>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t("apiKey.removeThisKey")}</span>
                <button
                  onClick={handleDeleteKey}
                  disabled={keyDeleting}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {keyDeleting ? <Loader2 size={11} className="animate-spin" /> : null}
                  {t("apiKey.yesRemove")}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1"
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title={t("apiKey.removeKeyTitle")}
                className="p-1 rounded-lg text-emerald-400 dark:text-emerald-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {!keyIsSet && (
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/40">
            <Key size={14} className="shrink-0" />
            {t("apiKey.noKeySet")}
          </div>
        )}

        {/* New key format notice */}
        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
          <Info size={13} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
          <span>
            {t.rich("apiKey.formatNotice", {
              code: (c) => <code className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">{c}</code>,
            })}
          </span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestState("idle"); }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              placeholder={keyIsSet ? t("apiKey.placeholderReplace") : t("apiKey.placeholderNew")}
              dir="ltr"
              className="w-full px-3 py-2.5 pe-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 dark:placeholder-slate-500 transition-colors"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            onClick={handleTestKey}
            disabled={testState === "testing" || (!apiKey.trim() && !keyIsSet)}
            title={t("apiKey.testTitle")}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors shrink-0 ${
              testState === "ok"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : testState === "error"
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
            }`}
          >
            {testState === "testing" ? <Loader2 size={14} className="animate-spin" /> : testState === "ok" ? <Check size={14} /> : <Zap size={14} />}
            {testState === "testing" ? t("apiKey.testing") : testState === "ok" ? t("apiKey.connected") : t("apiKey.test")}
          </button>
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim() || keySaving}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {keySaving ? <Loader2 size={14} className="animate-spin" /> : keySaved ? <Check size={14} /> : <Save size={14} />}
            {keySaved ? t("common.savedBang") : t("common.save")}
          </button>
        </div>
        {keyError && <p className="text-xs text-red-500">{keyError}</p>}
        {testState === "error" && testError && (
          <p className="text-xs text-red-500 dark:text-red-400">{testError}</p>
        )}
      </section>

      {/* ── Translation Language ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Globe size={17} className="text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("yourLang.heading")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("yourLang.desc")}
              </p>
            </div>
          </div>
          <button
            onClick={handleApplyLangs}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              langSaved ? "bg-emerald-600 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            <Check size={13} />
            {langSaved ? t("yourLang.applied") : t("yourLang.apply")}
          </button>
        </div>

        {/* English toggle */}
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("yourLang.english")}</p>
          <button
            onClick={() => {
              if (englishOn && !secondaryCode) return; // last one — can't turn off
              setEnglishOn((v) => !v);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-start transition-all ${
              englishOn
                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            } ${englishOn && !secondaryCode ? "cursor-not-allowed" : ""}`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              englishOn ? "border-brand-500 bg-brand-500" : "border-slate-300 dark:border-slate-600"
            }`}>
              {englishOn && <Check size={10} className="text-white" />}
            </span>
            <div>
              <p className={`text-sm font-semibold ${englishOn ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>{t("yourLang.english")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">English</p>
            </div>
            {englishOn && !secondaryCode && (
              <span className="ms-auto text-[10px] text-slate-400 dark:text-slate-500 italic">{t("yourLang.selectAnotherToDisable")}</span>
            )}
          </button>
        </div>

        {/* Secondary language — user picks one or none */}
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
            {t("yourLang.secondLanguage")} <span className="text-slate-300 dark:text-slate-600 font-normal normal-case">{t("yourLang.optionalDash")}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* None option */}
            <button
              onClick={() => { if (!englishOn) return; setSecondaryCode(""); }}
              disabled={!englishOn}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all ${
                secondaryCode === "" && englishOn
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                  : !englishOn
                    ? "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-40 cursor-not-allowed"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                secondaryCode === "" && englishOn ? "border-brand-500" : "border-slate-300 dark:border-slate-600"
              }`}>
                {secondaryCode === "" && englishOn && <span className="w-2 h-2 rounded-full bg-brand-500" />}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold leading-tight ${secondaryCode === "" && englishOn ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>
                  {t("yourLang.none")}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5">
                  {t("yourLang.noSecondLanguage")}
                </p>
              </div>
            </button>
            {SECONDARY_LANGUAGES.map((lang) => {
              const selected = secondaryCode === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSecondaryCode(lang.code)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* Radio dot */}
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? "border-brand-500" : "border-slate-300 dark:border-slate-600"
                  }`}>
                    {selected && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${selected ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>
                      {lang.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5" dir={lang.rtl ? "rtl" : "ltr"}>
                      {lang.nativeName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          {englishOn && !secondaryCode && (
            t.rich("yourLang.previewEnglishOnly", {
              b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
            })
          )}
          {!englishOn && secondaryCode && secondLangObj && (
            t.rich("yourLang.previewSecondaryOnly", {
              lang: `${secondLangObj.nativeName} (${secondLangObj.name})`,
              b: (c) => (
                <span className="font-semibold text-slate-700 dark:text-slate-200" dir={secondLangObj.rtl ? "rtl" : "ltr"}>
                  {c}
                </span>
              ),
            })
          )}
          {englishOn && secondaryCode && secondLangObj && (
            t.rich("yourLang.previewBoth", {
              lang: `${secondLangObj.nativeName} (${secondLangObj.name})`,
              b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
            })
          )}
        </div>
      </section>

      {/* ── German Level ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
            <BookOpen size={17} className="text-green-600 dark:text-green-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("level.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("level.desc")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setUserLevel(level)}
              className={`py-3 rounded-xl text-center transition-all border ${
                userLevel === level
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
              }`}
            >
              <div className="text-sm font-bold">{level}</div>
              <div className={`text-[9px] font-normal mt-0.5 ${userLevel === level ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>
                {t(`level.desc_${level}`)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Daily Learning Goal ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
            <Target size={17} className="text-orange-600 dark:text-orange-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("goal.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("goal.desc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setDailyGoal((g) => Math.max(1, g - 1))}
              className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold leading-none select-none"
            >
              −
            </button>
            <input
              type="number"
              value={dailyGoal}
              min={1}
              max={50}
              onChange={(e) =>
                setDailyGoal(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))
              }
              className="w-14 text-center text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none py-2"
            />
            <button
              onClick={() => setDailyGoal((g) => Math.min(50, g + 1))}
              className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold leading-none select-none"
            >
              +
            </button>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">{t("goal.wordsPerDay")}</span>
          <button
            onClick={handleSaveGoal}
            disabled={goalSaving}
            className={`ms-auto flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
              goalSaved
                ? "bg-emerald-600 text-white"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {goalSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : goalSaved ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            {goalSaved ? t("common.savedBang") : t("goal.saveGoal")}
          </button>
        </div>
      </section>

      {/* ── API Usage ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
              <Activity size={17} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("usage.heading")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("usage.trackedBy")}{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {t("usage.seeFullUsage")}
                </a>
              </p>
            </div>
          </div>
          <button
            onClick={handleResetUsage}
            disabled={usageResetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {usageResetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {t("usage.resetCounter")}
          </button>
        </div>

        {usage ? (
          <div className="space-y-3">
            {/* Text API counters */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                {t("usage.textAnalysis")} <span className="font-normal normal-case text-slate-300 dark:text-slate-600">{t("usage.textFreeTier")}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: t("usage.apiCalls"),       value: usage.calls.toLocaleString(),         color: "text-violet-600 dark:text-violet-400" },
                  { label: t("usage.inputTokens"),    value: usage.input_tokens.toLocaleString(),   color: "text-blue-600 dark:text-blue-400" },
                  { label: t("usage.outputTokens"),   value: usage.output_tokens.toLocaleString(),  color: "text-indigo-600 dark:text-indigo-400" },
                  { label: t("usage.thinkingTokens"), value: usage.thought_tokens.toLocaleString(), color: "text-purple-600 dark:text-purple-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* TTS counters */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                {t("usage.voiceTts")}{" "}
                <span className="font-normal normal-case text-amber-500 dark:text-amber-400">{t("usage.ttsNoFreeTier")}</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t("usage.ttsCalls"),      value: usage.tts_calls.toLocaleString(),         color: "text-orange-600 dark:text-orange-400" },
                  { label: t("usage.inputTokens"),   value: usage.tts_input_tokens.toLocaleString(),   color: "text-orange-500 dark:text-orange-400" },
                  { label: t("usage.outputTokens"),  value: usage.tts_output_tokens.toLocaleString(),  color: "text-rose-600 dark:text-rose-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rough cost note */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <Info size={13} className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
              <span>
                {t.rich("usage.costNote", {
                  total: usage.estimated_cost_usd.toFixed(4),
                  text: usage.text_cost_usd.toFixed(4),
                  tts: usage.tts_cost_usd.toFixed(4),
                  b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
                })}{" "}
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
                >
                  {t("usage.checkRealUsage")}
                </a>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-slate-400 dark:text-slate-600 text-sm">
            <Loader2 size={14} className="animate-spin me-2" /> {t("common.loading")}
          </div>
        )}
      </section>

      {/* ── Data Backup ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <HardDrive size={17} className="text-teal-600 dark:text-teal-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("backup.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("backup.desc")}
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Export */}
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {backingUp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {backingUp ? t("backup.exporting") : t("backup.exportBackup")}
          </button>

          {/* Restore — hidden file input + button */}
          {restoreState === "idle" || restoreState === "error" ? (
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
              <Upload size={14} />
              {t("backup.restoreFromBackup")}
              <input type="file" accept=".db" className="hidden" onChange={handleRestoreSelect} />
            </label>
          ) : null}
        </div>

        {/* Confirm restore */}
        {restoreState === "confirming" && restoreFile && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex-wrap">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              {t.rich("backup.replaceConfirm", {
                file: restoreFile.name,
                b: (c) => <span className="font-semibold" dir="ltr">{c}</span>,
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRestoreConfirm}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                {t("backup.yesRestore")}
              </button>
              <button
                onClick={() => { setRestoreState("idle"); setRestoreFile(null); }}
                className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {restoreState === "loading" && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={14} className="animate-spin" /> {t("backup.restoring")}
          </div>
        )}

        {restoreState === "done" && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200 flex-1">
              {t("backup.restored")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {t("backup.reloadApp")}
            </button>
          </div>
        )}

        {restoreState === "error" && restoreError && (
          <p className="text-xs text-red-500 dark:text-red-400">{restoreError}</p>
        )}
      </section>

      {/* ── Danger Zone ── */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/40 p-6 space-y-4 bg-red-50/40 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-red-600 dark:text-red-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("danger.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("danger.desc")}</p>
          </div>
        </div>

        {dangerError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 px-3 py-2 rounded-lg">{dangerError}</p>
        )}

        <div className="divide-y divide-red-100 dark:divide-red-900/30">
          {/* Reset all learnings */}
          <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("danger.resetLearnings")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("danger.resetLearningsDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {resetLearningsState === "confirming" && (
                <button
                  onClick={() => setResetLearningsState("idle")}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
              )}
              <button
                onClick={handleResetLearnings}
                disabled={resetLearningsState === "loading"}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  resetLearningsState === "done"
                    ? "bg-emerald-600 text-white"
                    : resetLearningsState === "confirming"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                } disabled:opacity-50`}
              >
                {resetLearningsState === "loading" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : resetLearningsState === "done" ? (
                  <Check size={12} />
                ) : (
                  <RotateCcw size={12} />
                )}
                {resetLearningsState === "done"
                  ? t("danger.resetDone")
                  : resetLearningsState === "confirming"
                  ? t("danger.confirmReset")
                  : t("danger.resetLearningsBtn")}
              </button>
            </div>
          </div>

          {/* Delete all vocabulary */}
          <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("danger.deleteVocab")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("danger.deleteVocabDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {deleteVocabState === "confirming" && (
                <button
                  onClick={() => setDeleteVocabState("idle")}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
              )}
              <button
                onClick={handleDeleteVocab}
                disabled={deleteVocabState === "loading"}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  deleteVocabState === "done"
                    ? "bg-emerald-600 text-white"
                    : deleteVocabState === "confirming"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                } disabled:opacity-50`}
              >
                {deleteVocabState === "loading" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : deleteVocabState === "done" ? (
                  <Check size={12} />
                ) : (
                  <Trash2 size={12} />
                )}
                {deleteVocabState === "done"
                  ? t("danger.deleted")
                  : deleteVocabState === "confirming"
                  ? t("danger.confirmDelete")
                  : t("danger.deleteVocabBtn")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
