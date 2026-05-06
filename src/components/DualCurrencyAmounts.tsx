/** RTL-safe display: amount + code on clear lines (avoids mixed bidirectional runs). */

export function DualCurrencyAmounts({
  originalAmount,
  originalCode,
  approxAmount,
  approxCode,
  size = "default",
  className = "",
}: {
  originalAmount: number | string;
  originalCode: string;
  approxAmount?: number | null;
  approxCode: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const small = size === "sm";
  return (
    <div
      className={`flex flex-col items-end gap-0.5 ${small ? "text-xs" : "text-sm"} ${className}`.trim()}
    >
      <span
        dir="ltr"
        className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-1.5 tabular-nums font-medium text-cream-900"
      >
        <span>{originalAmount}</span>
        <span className="shrink-0 text-cream-700">{originalCode}</span>
      </span>
      {approxAmount != null && Number.isFinite(approxAmount) ? (
        <span
          dir="ltr"
          className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-1 tabular-nums text-cream-600"
        >
          <span className="font-normal">≈</span>
          <span>{approxAmount.toFixed(2)}</span>
          <span className="shrink-0">{approxCode}</span>
        </span>
      ) : null}
    </div>
  );
}
