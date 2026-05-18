/** Shared sync helpers (testable without Electron). */

export function normalizeSyncBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `http://${t}`;
}

function semverParts(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/** True if clientSemver >= minSemver (naive major.minor.patch). */
export function semverGte(clientSemver: string, minSemver: string): boolean {
  const a = semverParts(clientSemver);
  const b = semverParts(minSemver);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}
