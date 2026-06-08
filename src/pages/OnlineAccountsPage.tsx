import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadFreeAccountEmails,
  loadSubscriptions,
  type SubscriptionListRow,
} from "../db/repo";
import { SiteFavicon } from "../components/SiteFavicon";
import { hostnameFromWebsiteUrl } from "../lib/siteFavicon";

export function OnlineAccountsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<SubscriptionListRow[]>([]);
  const [emails, setEmails] = useState<{ email: string; count: number }[]>([]);
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, mailRows] = await Promise.all([
        loadSubscriptions({
          recordKind: "free",
          search: deferredSearch.trim() || undefined,
        }),
        loadFreeAccountEmails(),
      ]);
      setItems(list);
      setEmails(mailRows);
    } finally {
      setLoading(false);
    }
  }, [deferredSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredItems = useMemo(() => {
    if (!emailFilter) return items;
    const key = emailFilter.trim().toLowerCase();
    return items.filter((s) => (s.account_label ?? "").trim().toLowerCase() === key);
  }, [items, emailFilter]);

  const emailMatchCount = emailFilter ? filteredItems.length : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("accounts.title")}</h2>
          <p className="sk-text-hint mt-1 text-sm">{t("accounts.subtitle")}</p>
        </div>
        <Link to="/new?kind=account" className="sk-btn-warm px-4 py-2.5 text-sm font-semibold">
          {t("accounts.addCta")}
        </Link>
      </div>

      <div className="sk-card space-y-3">
        <p className="text-sm text-cream-800">{t("accounts.searchExplain")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="sk-label" htmlFor="accounts-search">
              {t("common.search")}
            </label>
            <input
              ref={searchRef}
              id="accounts-search"
              className="sk-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("accounts.searchPlaceholder")}
              autoComplete="off"
            />
            <p className="mt-1 text-[10px] text-cream-500">{t("list.searchSlashHint")}</p>
          </div>
          <div>
            <label className="sk-label" htmlFor="accounts-email-filter">
              {t("accounts.filterByEmail")}
            </label>
            <select
              id="accounts-email-filter"
              className="sk-select"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
            >
              <option value="">{t("accounts.allEmails")}</option>
              {emails.map((row) => (
                <option key={row.email} value={row.email}>
                  {row.email} ({row.count})
                </option>
              ))}
            </select>
          </div>
        </div>
        {emailMatchCount != null ? (
          <p className="text-sm font-medium text-sage-800">
            {t("accounts.emailMatchCount", { count: emailMatchCount, email: emailFilter })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="sk-text-hint">{t("common.loading")}</p>
      ) : filteredItems.length === 0 ? (
        <div className="sk-card text-sm text-cream-700">
          <p>{t("accounts.empty")}</p>
          <Link to="/new?kind=account" className="mt-3 inline-block font-medium text-sage-800 underline">
            {t("accounts.addCta")}
          </Link>
        </div>
      ) : (
        <div className="sk-card overflow-x-auto p-0 shadow-sm">
          <table className="w-full min-w-[560px] text-start text-sm">
            <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
              <tr>
                <th className="px-3 py-3 font-semibold">{t("accounts.colSite")}</th>
                <th className="px-3 py-3 font-semibold">{t("accounts.colEmail")}</th>
                <th className="px-3 py-3 font-semibold">{t("accounts.colPurpose")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.category")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((s) => {
                const host = hostnameFromWebsiteUrl(s.website_url);
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t border-cream-300/80 hover:bg-cream-200/40"
                    onClick={() => nav(`/sub/${s.id}`)}
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        {s.website_url?.trim() ? (
                          <SiteFavicon websiteUrl={s.website_url} size="sm" className="mt-0.5 shrink-0" />
                        ) : null}
                        <div className="min-w-0">
                          <Link
                            to={`/sub/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-cream-950 underline-offset-2 hover:underline"
                          >
                            {s.title}
                          </Link>
                          {host ? (
                            <span dir="ltr" className="mt-0.5 block truncate text-xs text-cream-600">
                              {host}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top" dir="ltr">
                      {s.account_label?.trim() ? (
                        <button
                          type="button"
                          className="text-start text-sage-800 underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailFilter(s.account_label!.trim());
                          }}
                        >
                          {s.account_label.trim()}
                        </button>
                      ) : (
                        <span className="text-cream-500">—</span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 align-top text-cream-800">
                      {s.notes?.trim() ? (
                        <span className="line-clamp-3">{s.notes.trim()}</span>
                      ) : (
                        <span className="text-cream-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-cream-800">{s.category_name ?? "—"}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/sub/${s.id}/edit`}
                        className="text-walnut-600 underline-offset-2 hover:underline"
                      >
                        {t("common.edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
