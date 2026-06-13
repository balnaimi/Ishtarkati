import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { ISHTARKATI_MARK_SRC } from "../lib/publicAssets";
import { useDesktopReminders } from "../hooks/useDesktopReminders";
import { useUiDir } from "../hooks/useUiDir";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";

const linkCls = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "bg-cream-800 text-cream-50 shadow-sm"
      : "text-cream-800 hover:bg-cream-300/70"
  }`;

export function Layout() {
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const dir = useUiDir();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useDesktopReminders();

  useGlobalShortcuts({
    paletteOpen,
    helpOpen,
    onPalette: () => setPaletteOpen(true),
    onNew: () => nav("/new"),
    onHelp: () => setHelpOpen(true),
    onCloseOverlay: () => {
      setPaletteOpen(false);
      setHelpOpen(false);
    },
  });

  const navItems = [
    { to: "/", label: t("nav.home") },
    { to: "/accounts", label: t("nav.accounts") },
    { to: "/payments", label: t("nav.payments") },
    { to: "/insights", label: t("nav.insights") },
    { to: "/settings", label: t("nav.settings") },
  ];

  return (
    <div className="flex min-h-full flex-col font-sans" dir={dir}>
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="sk-btn-muted hidden text-xs sm:inline-flex"
              onClick={() => setPaletteOpen(true)}
              title={t("commandPalette.openHint")}
            >
              {t("commandPalette.openLabel")}
            </button>
            <nav className="flex flex-wrap gap-2">
              {navItems.map(({ to, label }) => {
                const homeMatch =
                  to === "/" && (loc.pathname === "/" || loc.pathname.startsWith("/sub"));
                const accountsMatch =
                  to === "/accounts" && (loc.pathname === "/accounts" || loc.pathname === "/list");
                const paymentsMatch = to === "/payments" && loc.pathname === "/payments";
                const insightsMatch = to === "/insights" && loc.pathname === "/insights";
                const active =
                  accountsMatch ||
                  paymentsMatch ||
                  insightsMatch ||
                  loc.pathname === to ||
                  (to !== "/" &&
                    to !== "/accounts" &&
                    to !== "/payments" &&
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
