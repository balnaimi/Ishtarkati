import { Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { ISHTARKATI_MARK_SRC } from "../lib/publicAssets";
import { useDesktopReminders } from "../hooks/useDesktopReminders";

const linkCls = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "bg-cream-800 text-cream-50 shadow-sm"
      : "text-cream-800 hover:bg-cream-300/70"
  }`;

export function Layout() {
  const { t } = useTranslation();
  const loc = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useDesktopReminders();

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ishtarkati_theme", next ? "dark" : "light");
    setDark(next);
  }

  const nav = [
    { to: "/", label: t("nav.home") },
    { to: "/list", label: t("nav.subscriptions") },
    { to: "/accounts", label: t("nav.accounts") },
    { to: "/cancelled", label: t("nav.cancelled") },
    { to: "/insights", label: t("nav.insights") },
    { to: "/settings", label: t("nav.settings") },
  ];

  return (
    <div className="flex min-h-full flex-col font-sans">
      <header className="border-b border-cream-400 bg-cream-100/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={ISHTARKATI_MARK_SRC}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm ring-1 ring-cream-400/80 dark:ring-cream-600/50"
              decoding="async"
            />
            <div>
              <h1 className="text-lg font-semibold text-cream-900">{t("app.title")}</h1>
              <p className="text-xs text-cream-600">
                {t("settings.version")} {APP_VERSION}
              </p>
            </div>
            <button
              type="button"
              className="sk-btn-muted text-sm"
              onClick={toggleTheme}
              aria-pressed={dark}
              aria-label={dark ? t("settings.themeLight") : t("settings.themeDark")}
            >
              {dark ? t("settings.themeUseLight") : t("settings.themeUseDark")}
            </button>
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map(({ to, label }) => {
              const homeMatch =
                to === "/" && (loc.pathname === "/" || loc.pathname.startsWith("/sub"));
              const listMatch = to === "/list" && loc.pathname === "/list";
              const accountsMatch = to === "/accounts" && loc.pathname === "/accounts";
              const cancelledMatch = to === "/cancelled" && loc.pathname === "/cancelled";
              const insightsMatch = to === "/insights" && loc.pathname === "/insights";
              const active =
                listMatch ||
                accountsMatch ||
                cancelledMatch ||
                insightsMatch ||
                loc.pathname === to ||
                (to !== "/" &&
                  to !== "/list" &&
                  to !== "/accounts" &&
                  to !== "/cancelled" &&
                  to !== "/insights" &&
                  loc.pathname.startsWith(to)) ||
                homeMatch;
              return (
                <Link key={to} to={to} className={linkCls(active)}>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
