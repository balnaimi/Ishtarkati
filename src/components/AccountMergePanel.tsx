import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionListRow } from "../db/repo";
import {
  findSimilarSubscriptions,
  mergeSubscriptionInto,
  setSubscriptionPinned,
} from "../db/repo";
import { formatUiError } from "../lib/uiErrors";
import { platformTypeI18nKey } from "../lib/platformIdentity";
import { ConfirmDialog } from "./ConfirmDialog";
import { PinToggleButton } from "./PinToggleButton";

type Props = {
  sub: SubscriptionListRow;
  onChanged: () => void;
};

export function AccountMergePanel({ sub, onChanged }: Props) {
  const { t } = useTranslation();
  const [similar, setSimilar] = useState<SubscriptionListRow[]>([]);
  const [mergeTarget, setMergeTarget] = useState<SubscriptionListRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reloadSimilar = useCallback(async () => {
    if (sub.cancelled_at) {
      setSimilar([]);
      return;
    }
    const rows = await findSimilarSubscriptions(
      {
        title: sub.title,
        website_url: sub.website_url,
        account_label: sub.account_label,
        login_username: sub.login_username,
      },
      sub.id,
    );
    setSimilar(rows);
  }, [sub]);

  useEffect(() => {
    void reloadSimilar();
  }, [reloadSimilar]);

  async function confirmMerge() {
    if (!mergeTarget) return;
    setBusy(true);
    setErr(null);
    try {
      await mergeSubscriptionInto(sub.id, mergeTarget.id);
      setMergeTarget(null);
      onChanged();
    } catch (e) {
      setErr(formatUiError(t, e));
    } finally {
      setBusy(false);
    }
  }

  if (sub.cancelled_at || similar.length === 0) return null;

  return (
    <>
      <ConfirmDialog
        open={mergeTarget != null}
        title={t("accounts.mergeConfirmTitle")}
        message={t("accounts.mergeConfirmBody", {
          keep: sub.title,
          merge: mergeTarget?.title ?? "",
        })}
        confirmLabel={t("accounts.mergeConfirmBtn")}
        variant="danger"
        onConfirm={() => void confirmMerge()}
        onCancel={() => setMergeTarget(null)}
      />
      <div className="sk-card space-y-3">
        <div>
          <h3 className="font-semibold text-cream-900">{t("accounts.mergeSectionTitle")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-cream-600">{t("accounts.mergeSectionHint")}</p>
        </div>
        {err ? <p className="text-sm text-brand-danger">{err}</p> : null}
        <ul className="space-y-2">
          {similar.map((other) => (
            <li
              key={other.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-400/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cream-950">{other.title}</p>
                <p className="text-[11px] sk-text-hint">
                  {other.account_label?.trim() || other.login_username?.trim() || "—"}
                  {other.platform_type ? ` · ${t(platformTypeI18nKey(other.platform_type))}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="sk-btn-secondary text-xs"
                disabled={busy}
                onClick={() => setMergeTarget(other)}
              >
                {t("accounts.mergeIntoThis")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function AccountPinControl({
  sub,
  onChanged,
  variant = "labeled",
  className,
}: {
  sub: SubscriptionListRow;
  onChanged: () => void;
  variant?: "compact" | "labeled";
  className?: string;
}) {
  if (sub.cancelled_at) return null;

  async function toggle() {
    await setSubscriptionPinned(sub.id, !(sub.is_pinned ?? 0));
    onChanged();
  }

  return (
    <PinToggleButton
      pinned={Boolean(sub.is_pinned)}
      variant={variant}
      className={className}
      onToggle={() => void toggle()}
    />
  );
}
