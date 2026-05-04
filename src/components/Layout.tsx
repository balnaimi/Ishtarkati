import { Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ishtarkati_theme", next ? "dark" : "light");
    setDark(next);
  }

  const nav = [
    { to: "/", label: t("nav.subscriptions") },
    { to: "/new", label: t("nav.add") },
    { to: "/categories", label: t("nav.categories") },
    { to: "/stats", label: t("nav.stats") },
    { to: "/settings", label: t("nav.settings") },
  ];

  return (
    <div className="flex min-h-full flex-col font-sans">
      <header className="border-b border-cream-400 bg-cream-100/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-cream-900">{t("app.title")}</h1>
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
              const homeMatch = to === "/" && (loc.pathname === "/" || loc.pathname.startsWith("/sub"));
              const active =
                loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to)) || homeMatch;
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
