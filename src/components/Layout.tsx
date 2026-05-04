import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

const linkCls = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-slate-700 text-white"
      : "text-slate-200 hover:bg-slate-800"
  }`;

export function Layout() {
  const { t } = useTranslation();
  const loc = useLocation();

  const nav = [
    { to: "/", label: t("nav.subscriptions") },
    { to: "/new", label: t("nav.add") },
    { to: "/categories", label: t("nav.categories") },
    { to: "/stats", label: t("nav.stats") },
    { to: "/settings", label: t("nav.settings") },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-950 font-sans text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold text-white">{t("app.title")}</h1>
          <nav className="flex flex-wrap gap-1">
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
