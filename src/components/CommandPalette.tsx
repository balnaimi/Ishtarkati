import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loadSubscriptions } from "../db/repo";
import type { SubscriptionListRow } from "../db/repo";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type PaletteItem =
  | { kind: "nav"; id: string; label: string; to: string }
  | { kind: "sub"; id: number; label: string; to: string };

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [subs, setSubs] = useState<SubscriptionListRow[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems: PaletteItem[] = useMemo(
    () => [
      { kind: "nav", id: "home", label: t("nav.home"), to: "/" },
      { kind: "nav", id: "accounts", label: t("nav.accounts"), to: "/accounts" },
      { kind: "nav", id: "new", label: t("commandPalette.newAccount"), to: "/new" },
      { kind: "nav", id: "payments", label: t("nav.payments"), to: "/payments" },
      { kind: "nav", id: "insights", label: t("nav.insights"), to: "/insights" },
      { kind: "nav", id: "settings", label: t("nav.settings"), to: "/settings" },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    void loadSubscriptions({ subscriptionStatus: "active" }).then(setSubs);
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(tmr);
  }, [open]);

  const q = query.trim().toLowerCase();

  const subItems: PaletteItem[] = useMemo(() => {
    if (!q) return [];
    return subs
      .filter((s) => {
        const hay = [s.title, s.website_url, s.account_label, s.notes, s.category_name, s.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12)
      .map((s) => ({
        kind: "sub" as const,
        id: s.id,
        label: s.title,
        to: `/sub/${s.id}`,
      }));
  }, [subs, q]);

  const items = useMemo(() => {
    const filteredNav = q
      ? navItems.filter((n) => n.label.toLowerCase().includes(q))
      : navItems;
    return [...filteredNav, ...subItems];
  }, [navItems, subItems, q]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = useCallback(
    (to: string) => {
      onClose();
      nav(to);
    },
    [nav, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="sk-modal-overlay items-start pt-[12vh]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="sk-dialog-panel w-full max-w-lg overflow-hidden p-0 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="sk-input w-full rounded-none border-0 border-b border-cream-400 bg-transparent px-4 py-3 text-base"
          placeholder={t("commandPalette.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(items.length - 1, i + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
              return;
            }
            if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              go(items[active].to);
            }
          }}
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-cream-600">{t("commandPalette.empty")}</li>
          ) : (
            items.map((item, idx) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm ${
                    idx === active
                      ? "bg-violet-500/12 text-cream-950 dark:bg-violet-500/20"
                      : "text-cream-800 hover:bg-cream-200/80"
                  }`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.to)}
                >
                  <span className="text-xs uppercase tracking-wide text-cream-500">
                    {item.kind === "nav" ? t("commandPalette.sectionNav") : t("commandPalette.sectionAccount")}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-cream-300 px-4 py-2 text-xs text-cream-600">
          {t("commandPalette.hint")}
        </p>
      </div>
    </div>
  );
}
