import type { TFunction } from "i18next";
import { getPrimaryCurrencyCode, getSetting, loadSubscriptions } from "../db/repo";
import type { SubscriptionListRow } from "../db/repo";

const MAX_BODY = 1900;

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function formatSubLine(s: SubscriptionListRow, primaryCode: string): string {
  const acc = s.account_label?.trim() ? ` (${s.account_label.trim()})` : "";
  const amt = `${s.amount_original} ${s.currency_code}`;
  const approx =
    s.amount_qar_snapshot != null && s.currency_code.toUpperCase() !== primaryCode.toUpperCase()
      ? ` — ≈ ${s.amount_qar_snapshot.toFixed(2)} ${primaryCode}`
      : "";
  return `• ${s.title}${acc}: ${amt}${approx}`;
}

function truncateBody(body: string): string {
  if (body.length <= MAX_BODY) return body;
  return `${body.slice(0, MAX_BODY - 20)}\n…`;
}

/** Desktop notifications: due-soon digest (once per calendar day) + optional weekly/monthly summaries. */
export async function runDesktopReminders(t: TFunction): Promise<void> {
  const remindersOn = await getSetting("reminders_enabled");
  if (remindersOn !== "1") return;

  const daysStr = await getSetting("reminder_due_days");
  const days = Math.max(1, Math.min(90, parseInt(daysStr ?? "7", 10) || 7));

  const near = await loadSubscriptions({ dueWithinDays: days });
  const withDue = near.filter((s) => s.next_due_date);
  if (withDue.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `due_digest_${today}`;
    if (!localStorage.getItem(key)) {
      const primary = await getPrimaryCurrencyCode();
      const lines = withDue.slice(0, 12).map((s) => formatSubLine(s, primary));
      const more =
        withDue.length > 12 ? `\n… ${t("notify.digestMore", { n: withDue.length - 12 })}` : "";
      const intro = t("notify.digestIntro", { count: withDue.length, days });
      const body = truncateBody(`${intro}\n${lines.join("\n")}${more}`);
      await window.ishtarkati.showNotification({
        title: t("notify.digestTitle"),
        body,
      });
      localStorage.setItem(key, "1");
    }
  }

  const primary = await getPrimaryCurrencyCode();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthKey = todayStr.slice(0, 7);

  const weeklyOn = (await getSetting("reminder_weekly_enabled")) === "1";
  if (weeklyOn) {
    const wk = isoWeekKey(today);
    const lsKey = `sk_weekly_digest_${wk}`;
    if (!localStorage.getItem(lsKey)) {
      const upcoming = await loadSubscriptions({ dueWithinDays: 14 });
      const rows = upcoming.filter((s) => s.next_due_date);
      if (rows.length > 0) {
        const lines = rows.slice(0, 15).map((s) => formatSubLine(s, primary));
        const body = truncateBody(
          `${t("notify.weeklyDigestIntro", { count: rows.length })}\n${lines.join("\n")}`,
        );
        await window.ishtarkati.showNotification({
          title: t("notify.weeklyDigestTitle"),
          body,
        });
      }
      localStorage.setItem(lsKey, "1");
    }
  }

  const monthlyOn = (await getSetting("reminder_monthly_enabled")) === "1";
  if (monthlyOn) {
    const lsKey = `sk_monthly_digest_${monthKey}`;
    if (!localStorage.getItem(lsKey)) {
      const upcoming = await loadSubscriptions({ dueWithinDays: 31 });
      const rows = upcoming.filter((s) => s.next_due_date);
      if (rows.length > 0) {
        const lines = rows.slice(0, 15).map((s) => formatSubLine(s, primary));
        const body = truncateBody(
          `${t("notify.monthlyDigestIntro", { count: rows.length })}\n${lines.join("\n")}`,
        );
        await window.ishtarkati.showNotification({
          title: t("notify.monthlyDigestTitle"),
          body,
        });
      }
      localStorage.setItem(lsKey, "1");
    }
  }
}
