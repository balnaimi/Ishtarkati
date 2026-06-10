import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadAllAccountEmails,
  loadSubscriptions,
  type SubscriptionListRow,
} from "../db/repo";
import { filterFreeAccounts } from "../lib/accountSearch";
import {
  accountPageFilterMatches,
  accountPaymentStatus,
  accountPaymentStatusI18nKey,
  type AccountPageFilter,
} from "../lib/subscriptionKind";
import { CancelledAccountsTab } from "../components/CancelledAccountsTab";
import { SiteFavicon } from "../components/SiteFavicon";
import { hostnameFromWebsiteUrl } from "../lib/siteFavicon";

type AccountsPageTab = "active" | "deleted";

function paymentStatusBadgeClass(status: ReturnType<typeof accountPaymentStatus>): string {
  if (status === "free") return "bg-cream-200/90 text-cream-800";
  if (status === "one_time") return "bg-walnut-100/90 text-walnut-800";
  return "bg-sage-100/90 text-sage-900";
}

export function OnlineAccountsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageTab: AccountsPageTab =
    searchParams.get("tab") === "deleted" ? "deleted" : "active";
  const searchRef = useRef<HTMLInputElement>(null);
  const [allItems, setAllItems] = useState<SubscriptionListRow[]>([]);
  const [emails, setEmails] = useState<{ email: string; count: number }[]>([]);
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [payFilter, setPayFilter] = useState<AccountPageFilter>("all");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, mailRows] = await Promise.all([
        loadSubscriptions({ recordKind: "all" }),
        loadAllAccountEmails(),
      ]);
      setAllItems(list);
      setEmails(mailRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, location.pathname, location.key]);

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
    const byPay = allItems.filter((s) => accountPageFilterMatches(s, payFilter));
    return filterFreeAccounts(byPay, { search, email: emailFilter });
  }, [allItems, payFilter, search, emailFilter]);

  const hasActiveFilter =
    search.trim().length > 0 || emailFilter.length > 0 || payFilter !== "all";
  const emailMatchCount = emailFilter ? filteredItems.length : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("accounts.title")}</h2>
          <p className="sk-text-hint mt-1 text-sm">{t("accounts.subtitle")}</p>
        </div>
        {pageTab === "active" ? (
          <Link to="/new" className="sk-btn-warm px-4 py-2.5 text-sm font-semibold">
            {t("accounts.addCta")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-cream-400/70 pb-1">
        {(
          [
            ["active", t("accounts.tabActive")] as const,
            ["deleted", t("accounts.tabDeleted")] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              pageTab === id
                ? "bg-cream-800 text-cream-50"
                : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
            }`}
            onClick={() => {
              if (id === "active") {
                setSearchParams({}, { replace: true });
              } else {
                setSearchParams({ tab: "deleted" }, { replace: true });
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === "deleted" ? (
        <div className="space-y-3">
          <p className="text-sm text-cream-700">{t("cancelled.subtitle")}</p>
          <CancelledAccountsTab />
        </div>
      ) : null}

      {pageTab === "active" ? (
      <>
      <div className="sk-card space-y-3">
        <p className="text-sm text-cream-800">{t("accounts.searchExplain")}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", t("accounts.filterAll")] as const,
              ["free", t("accounts.filterFree")] as const,
              ["paid", t("accounts.filterPaid")] as const,
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                payFilter === id
                  ? "bg-cream-800 text-cream-50"
                  : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
              }`}
              onClick={() => setPayFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
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
        {hasActiveFilter ? (
          <p className="text-sm text-cream-800">
            {t("accounts.searchResultCount", { count: filteredItems.length })}
            {emailMatchCount != null ? (
              <>
                {" — "}
                {t("accounts.emailMatchCount", { count: emailMatchCount, email: emailFilter })}
              </>
            ) : null}
            {filteredItems.length === 0 ? (
              <button
                type="button"
                className="ms-2 font-medium text-sage-800 underline"
                onClick={() => {
                  setSearch("");
                  setEmailFilter("");
                  setPayFilter("all");
                }}
              >
                {t("accounts.clearFilters")}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      {loading && allItems.length === 0 ? (
        <p className="sk-text-hint">{t("common.loading")}</p>
      ) : allItems.length === 0 ? (
        <div className="sk-card text-sm text-cream-700">
          <p>{t("accounts.empty")}</p>
          <Link to="/new" className="mt-3 inline-block font-medium text-sage-800 underline">
            {t("accounts.addCta")}
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="sk-card text-sm text-cream-700">
          <p>{t("accounts.noSearchResults")}</p>
          <button
            type="button"
            className="mt-3 font-medium text-sage-800 underline"
            onClick={() => {
              setSearch("");
              setEmailFilter("");
              setPayFilter("all");
            }}
          >
            {t("accounts.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="sk-card overflow-x-auto p-0 shadow-sm">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
              <tr>
                <th className="px-3 py-3 font-semibold">{t("accounts.colSite")}</th>
                <th className="px-3 py-3 font-semibold">{t("accounts.colEmail")}</th>
                <th className="px-3 py-3 font-semibold">{t("accounts.colPayment")}</th>
                <th className="px-3 py-3 font-semibold">{t("accounts.colPurpose")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.category")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((s) => {
                const host = hostnameFromWebsiteUrl(s.website_url);
                const payStatus = accountPaymentStatus(s);
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
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${paymentStatusBadgeClass(payStatus)}`}
                      >
                        {t(accountPaymentStatusI18nKey(payStatus))}
                      </span>
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
      </>
      ) : null}
    </div>
  );
}
