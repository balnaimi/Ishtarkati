import type { SubscriptionListRow } from "../db/repo";
import type { TFunction } from "i18next";

function csvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** UTF-8 with BOM for Excel compatibility with Arabic. */
export function downloadSubscriptionsCsv(rows: SubscriptionListRow[], t: TFunction<"translation">): void {
  const headers = [
    t("list.name"),
    t("list.category"),
    t("list.billing"),
    t("list.amount"),
    t("list.nextDue"),
    t("form.startDate"),
    t("list.qar"),
    t("form.tags"),
    t("form.notes"),
    t("form.website"),
  ];
  const lines = [
    headers.map((h) => csvCell(h)).join(","),
    ...rows.map((s) =>
      [
        s.title,
        s.category_name ?? "",
        s.billing_model,
        `${s.amount_original}`,
        s.next_due_date ?? "",
        s.start_date ?? "",
        s.amount_qar_snapshot != null ? String(s.amount_qar_snapshot) : "",
        s.tags ?? "",
        s.notes ?? "",
        s.website_url ?? "",
      ]
        .map((c) => csvCell(c))
        .join(","),
    ),
  ];
  const body = "\uFEFF" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`ishtarkati-subscriptions-${stamp}.csv`, body, "text/csv;charset=utf-8");
}

function icsTextEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatIcsDate(d: string): string {
  return d.replace(/-/g, "").slice(0, 8);
}

function formatIcsUtcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

export function downloadSubscriptionsIcs(rows: SubscriptionListRow[], t: TFunction<"translation">): void {
  const withDue = rows.filter((s) => s.next_due_date);
  const dtStamp = formatIcsUtcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ishtarkati//AR",
    "CALSCALE:GREGORIAN",
  ];
  for (const s of withDue) {
    const due = s.next_due_date!.slice(0, 10);
    const sum = icsTextEscape(`${s.title} — ${t("list.nextDue")}`);
    const desc = icsTextEscape(
      [s.notes, s.website_url, s.tags].filter(Boolean).join(" — ") || t("app.title"),
    );
    lines.push(
      "BEGIN:VEVENT",
      `UID:ishtarkati-${s.id}-${due}@ishtarkati.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(due)}`,
      `SUMMARY:${sum}`,
      `DESCRIPTION:${desc}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`ishtarkati-calendar-${stamp}.ics`, body, "text/calendar;charset=utf-8");
}
