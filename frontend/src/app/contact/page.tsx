"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Linkedin, Github, Globe, Send, Coffee, Sparkles } from "lucide-react";

// emoji + English mail-subject tag stay fixed; labels/placeholders are translated
const SUBJECTS = [
  { value: "feedback",      emoji: "💡", mailSubject: "Feedback" },
  { value: "bug",           emoji: "🐛", mailSubject: "Bug Report" },
  { value: "collaboration", emoji: "🤝", mailSubject: "Collaboration" },
  { value: "hi",            emoji: "👋", mailSubject: "Just saying hi" },
] as const;

const OWNER_EMAIL = "deutschpath.sjelodari@gmail.com";

export default function ContactPage() {
  const t = useTranslations("contact");
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]["value"]>("feedback");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const current = SUBJECTS.find((s) => s.value === subject)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      name  ? `From: ${name}`     : null,
      email ? `Reply-to: ${email}` : null,
      "",
      message,
    ]
      .filter((l) => l !== null)
      .join("\n");

    const mailtoHref = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(
      `[DeutschPath – ${current.mailSubject}]`
    )}&body=${encodeURIComponent(body)}`;

    window.open(mailtoHref, "_blank");
    setSent(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">

      {/* Profile card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">

        {/* Banner */}
        <div className="h-28 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/background.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-brand-900/30" />
        </div>

        {/* Identity */}
        <div className="relative z-10 px-8 pb-8 -mt-10">
          <div className="flex items-end justify-between mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/profile.png"
              alt="Saber Jelodari"
              className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-slate-900 shadow-md"
            />
            <div className="flex items-center gap-2 mb-1">
              <a
                href="https://www.linkedin.com/in/saber-jelodari/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-10 h-10 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="https://github.com/sjelodari"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Github size={18} />
              </a>
              <a
                href="https://saberjelodari.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Website"
                className="w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Globe size={18} />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Saber Jelodari</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("buildingStuff")}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t("tagline")}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-4">
            {t("bio")}
          </p>
        </div>
      </div>

      {/* Buy Me a Coffee */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm mb-6 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40">
        <div className="pointer-events-none absolute -top-6 -end-6 w-32 h-32 rounded-full bg-amber-200/40 dark:bg-amber-700/20" />
        <div className="pointer-events-none absolute -bottom-4 -start-4 w-20 h-20 rounded-full bg-orange-200/40 dark:bg-orange-700/20" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl select-none">☕</span>
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-tight">
                  {t("fuelNextFeature")}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {t("caffeinePowered")}
                </p>
              </div>
            </div>
            <span className="flex-shrink-0 text-lg select-none">🇩🇪</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed mb-4">
            {t("oneCoffee")}
          </p>
          <a
            href="https://buymeacoffee.com/sjelodari"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-900 font-bold text-sm rounded-xl shadow-sm transition-all duration-150"
          >
            <Coffee size={15} className="group-hover:animate-bounce" />
            {t("buyMeACoffee")}
            <span className="text-amber-700 font-normal text-xs" dir="ltr">→ buymeacoffee.com/sjelodari</span>
          </a>
        </div>
      </div>

      {/* Contact form */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-5xl select-none mb-1">🎉</div>
            <p className="text-slate-800 dark:text-slate-100 font-bold text-lg">
              Danke schön!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              {t.rich("sentBody", {
                email: OWNER_EMAIL,
                a: (c) => (
                  <a href={`mailto:${OWNER_EMAIL}`} className="text-brand-600 hover:underline" dir="ltr">
                    {c}
                  </a>
                ),
              })}
            </p>
            <button
              onClick={() => { setSent(false); setName(""); setEmail(""); setMessage(""); }}
              className="mt-3 px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              {t("sendAnother")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={16} className="text-brand-500" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t("dropMeALine")}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Subject pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  {t("whatsOnYourMind")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSubject(s.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        subject === s.value
                          ? "bg-brand-600 border-brand-600 text-white shadow-sm scale-105"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
                      }`}
                    >
                      {s.emoji} {t(`subjects.${s.value}.label`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    {t("yourName")} <span className="text-slate-400 font-normal normal-case">{t("optional")}</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    {t("yourEmail")} <span className="text-slate-400 font-normal normal-case">{t("optionalForReply")}</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  {t("message")} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  placeholder={t(`subjects.${current.value}.placeholder`)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="submit"
                  className="group px-7 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all duration-150"
                >
                  <Send size={14} className="group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:-scale-x-100 transition-transform" />
                  {t("sendIt")}
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-600">
                  {t("opensEmailClient")}
                </p>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
        {t.rich("footer", {
          a: (c) => (
            <a href="https://github.com/sjelodari/DeutschPath" target="_blank" rel="noopener noreferrer" className="hover:text-slate-500 transition-colors">
              {c}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
