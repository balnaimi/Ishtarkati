import { useEffect, useMemo, useState } from "react";
import { faviconCandidateUrls, hostnameFromWebsiteUrl } from "../lib/siteFavicon";

const FAVICON_CACHE_PREFIX = "sk_favicon_v1:";

function readCachedFaviconIndex(host: string): number | null {
  try {
    const raw = localStorage.getItem(`${FAVICON_CACHE_PREFIX}${host}`);
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeCachedFaviconIndex(host: string, index: number): void {
  try {
    localStorage.setItem(`${FAVICON_CACHE_PREFIX}${host}`, String(index));
  } catch {
    /* ignore quota */
  }
}

const framePad = {
  xs: "h-5 w-5 min-h-5 min-w-5 p-0.5",
  sm: "h-7 w-7 min-h-7 min-w-7 p-1",
  md: "h-10 w-10 min-h-10 min-w-10 p-1",
  lg: "h-12 w-12 min-h-12 min-w-12 p-1.5",
} as const;

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 0 0 18M12 3a15 15 0 0 1 0 18" />
    </svg>
  );
}

export function SiteFavicon({
  websiteUrl,
  size = "md",
  className = "",
}: {
  websiteUrl: string | null | undefined;
  size?: keyof typeof framePad;
  className?: string;
}) {
  const host = useMemo(() => hostnameFromWebsiteUrl(websiteUrl ?? null), [websiteUrl]);
  const candidates = useMemo(() => (host ? faviconCandidateUrls(host) : []), [host]);
  const [idx, setIdx] = useState(() => (host ? (readCachedFaviconIndex(host) ?? 0) : 0));

  useEffect(() => {
    setIdx(host ? (readCachedFaviconIndex(host) ?? 0) : 0);
  }, [host]);

  const frame = `inline-flex shrink-0 items-center justify-center rounded-xl border border-cream-400 bg-cream-100 shadow-sm ${framePad[size]} ${className}`.trim();

  if (!host || candidates.length === 0) {
    return null;
  }

  if (idx >= candidates.length) {
    return (
      <span className={frame} title={host}>
        <GlobeIcon className="h-[55%] w-[55%] text-sage-600" />
      </span>
    );
  }

  const src = candidates[idx]!;

  return (
    <span className={frame} title={host}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain"
        onLoad={() => writeCachedFaviconIndex(host, idx)}
        onError={() => setIdx((i) => i + 1)}
      />
    </span>
  );
}
