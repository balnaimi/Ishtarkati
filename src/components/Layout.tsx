import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { ISHTARKATI_MARK_SRC } from "../lib/publicAssets";
import { useDesktopReminders } from "../hooks/useDesktopReminders";
import { useUiDir } from "../hooks/useUiDir";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { AboutDialog } from "./AboutDialog";
import { CloseChoiceDialog } from "./CloseChoiceDialog";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";
import { UpdateDialog } from "./UpdateDialog";
import { useAppUpdateCheck } from "../hooks/useAppUpdateCheck";
import { useCloseChoiceListener } from "../hooks/useCloseChoiceListener";
import {
  IconAccounts,
  IconHome,
  IconInsights,
  IconPayments,
  IconSettings,
} from "./NavIcons";
import { getSetting } from "../db/repo";
import { THEME_MODE_KEY } from "../lib/settingsKeys";
import { parseThemeMode, persistThemeMode, type ThemeMode } from "../lib/theme";

function navActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/" || pathname.startsWith("/sub");
  if (to === "/accounts")
    return pathname === "/accounts" || pathname === "/list";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Layout() {
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const dir = useUiDir();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const { state: updateState, dialogOpen, setDialogOpen, check, dismissDialog, openDialog, currentVersion } =
    useAppUpdateCheck();
  const { open: closeChoiceOpen, setOpen: setCloseChoiceOpen } = useCloseChoiceListener();
  useDesktopReminders();

  useEffect(() => {
    void getSetting(THEME_MODE_KEY).then((raw) => setThemeMode(parseThemeMode(raw)));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncFromDom = () => {
      setThemeMode(root.classList.contains("dark") ? "dark" : "light");
    };
    const obs = new MutationObserver(syncFromDom);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useGlobalShortcuts({
    paletteOpen,
    helpOpen,
    aboutOpen,
    closeChoiceOpen,
    onPalette: () => setPaletteOpen(true),
    onNew: () => nav("/new"),
    onHelp: () => setHelpOpen(true),
    onCloseOverlay: () => {
      setPaletteOpen(false);
      setHelpOpen(false);
      setAboutOpen(false);
      setCloseChoiceOpen(false);
    },
  });

  const navItems = [
    { to: "/", label: t("nav.home"), Icon: IconHome },
    { to: "/accounts", label: t("nav.accounts"), Icon: IconAccounts },
    { to: "/payments", label: t("nav.payments"), Icon: IconPayments },
    { to: "/insights", label: t("nav.insights"), Icon: IconInsights },
    { to: "/settings", label: t("nav.settings"), Icon: IconSettings },
  ];

  async function toggleTheme() {
    const next: ThemeMode = themeMode === "dark" ? "light" : "dark";
    await persistThemeMode(next);
    setThemeMode(next);
  }

  return (
    <div className="dash-shell font-sans" dir={dir}>
      <aside className="dash-sidebar hidden md:flex">
        <div className="dash-sidebar-brand">
          <img
            src={ISHTARKATI_MARK_SRC}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-xl ring-1 ring-violet-500/40"
            decoding="async"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-cream-950">{t("app.title")}</p>
            <p className="text-[11px] sk-text-hint">{t("app.tagline")}</p>
          </div>
        </div>

        <nav className="dash-sidebar-nav" aria-label={t("nav.home")}>
          {navItems.map(({ to, label, Icon }) => {
            const active = navActive(loc.pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={`dash-nav-item ${active ? "dash-nav-item-active" : ""}`}
              >
                <Icon className="size-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-footer">
          <button
            type="button"
            className="dash-btn-ghost w-full text-xs"
            onClick={() => setPaletteOpen(true)}
          >
            {t("commandPalette.openLabel")}
          </button>
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-cream-400/60 px-3 py-2 text-xs text-cream-700">
            <span>{t("layout.darkMode")}</span>
            <input
              type="checkbox"
              className="size-4 rounded border-cream-500 accent-violet-500"
              checked={themeMode === "dark"}
              onChange={() => void toggleTheme()}
            />
          </label>
          <button
            type="button"
            className="dash-btn-ghost w-full text-start text-xs"
            onClick={() => setAboutOpen(true)}
          >
            {t("about.sidebarLabel")}
          </button>
          <button
            type="button"
            className={`dash-btn-ghost w-full text-start text-xs ${
              updateState.status === "available" ? "text-violet-600 dark:text-violet-300" : ""
            }`}
            onClick={() => {
              if (
                updateState.status === "idle" ||
                updateState.status === "checking" ||
                updateState.status === "error"
              ) {
                void check().then(() => openDialog());
              } else {
                openDialog();
              }
            }}
            disabled={updateState.status === "checking"}
          >
            {updateState.status === "checking"
              ? t("updates.checking")
              : updateState.status === "available"
                ? t("updates.sidebarAvailable", { version: updateState.latest })
                : updateState.status === "error"
                  ? t("updates.sidebarError")
                  : t("updates.sidebarCurrent", { version: currentVersion })}
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cream-400/60 px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <img src={ISHTARKATI_MARK_SRC} alt="" className="size-8 rounded-lg" />
            <span className="font-semibold text-cream-950">{t("app.title")}</span>
          </div>
          <select
            className="sk-select !min-h-9 max-w-[10rem] py-1 text-xs"
            value={loc.pathname}
            onChange={(e) => nav(e.target.value)}
            aria-label={t("nav.home")}
          >
            {navItems.map(({ to, label }) => (
              <option key={to} value={to}>
                {label}
              </option>
            ))}
          </select>
        </header>

        <div className="dash-main-scroll">
          <div className="dash-main-inner">
            <Outlet />
          </div>
        </div>

        <footer className="dash-footer">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {t("settings.version")} {APP_VERSION}
            </span>
            <button
              type="button"
              className="text-violet-600 underline-offset-2 hover:underline md:hidden dark:text-violet-300"
              onClick={() => setAboutOpen(true)}
            >
              {t("about.footerLabel")}
            </button>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 animate-pulse rounded-full bg-sage-400" aria-hidden />
            {t("layout.systemOk")}
          </span>
        </footer>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CloseChoiceDialog open={closeChoiceOpen} onCancel={() => setCloseChoiceOpen(false)} />
      <UpdateDialog
        open={dialogOpen}
        state={updateState}
        currentVersion={currentVersion}
        onClose={() => setDialogOpen(false)}
        onDismiss={updateState.status === "available" ? dismissDialog : undefined}
      />
    </div>
  );
}
