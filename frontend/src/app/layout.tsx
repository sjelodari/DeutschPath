import type { Metadata } from "next";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { TabNav } from "@/src/components/layout/TabNav";
import { ShutdownGuard } from "@/src/components/layout/ShutdownGuard";
import { LocaleSync } from "@/src/components/layout/LocaleSync";
import { dirFor } from "@/src/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("layout");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    icons: { icon: "/favicon.png" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("layout");
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        {/* Anti-flash: set dark class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <NextIntlClientProvider>
          <LocaleSync />
          <ShutdownGuard />
          <TabNav />
          <main className="pt-16">{children}</main>
          <footer className="mt-12 pb-6 text-center text-xs text-slate-400 dark:text-slate-600 px-4 space-y-1">
            <p>
              {t("madeBy")}{" "}
              <a
                href="https://www.linkedin.com/in/saber-jelodari/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
              >
                Saber Jelodari
              </a>
            </p>
            <p>{t("aiDisclaimer")}</p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
