import { ipcMain, Notification } from "electron";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { argon2id } from "@noble/hashes/argon2.js";
import {
  BACKUP_EXPORT_VERSION,
  buildBackupPayloadFromDatabase,
  buildImportPreview,
  parseBackupJson,
  type ImportPreviewDTO,
} from "./backup";

const SYNC_BASE_URL = "sync_base_url";
const SYNC_VAULT_ID = "sync_vault_id";
const SYNC_SERVER_REVISION = "sync_server_revision";
const SYNC_VAULT_DISPLAY_NAME = "sync_vault_display_name";

const DEFAULT_KDF = {
  memory: 65536,
  iterations: 3,
  parallelism: 4,
  keyLength: 32,
} as const;

type VaultStatusDTO = {
  vault_id: string;
  display_name?: string;
  revision: number;
  updated_at: string;
  has_snapshot: boolean;
  salt_b64: string;
  kdf: {
    memory: number;
    iterations: number;
    parallelism: number;
    keyLength: number;
  };
  min_client_semver: string;
  max_backup_export_version: number;
};

type CapabilitiesDTO = {
  api_version: number;
  server_semver?: string;
  min_client_semver: string;
  max_backup_export_version: number;
};

type SessionPayload = {
  masterKey: Buffer;
  bearerHex: string;
};

const sessionByVault = new Map<string, SessionPayload>();

type GetAppVersion = () => string;
let resolveAppVersion: GetAppVersion = () => "0.0.0";
const AUTOPUSH_MS = 12_000;
let autoPushTimer: ReturnType<typeof setTimeout> | null = null;

function dbGet(database: Database.Database, key: string): string | null {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function dbSet(database: Database.Database, key: string, value: string): void {
  database.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

function dbDel(database: Database.Database, key: string): void {
  database.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

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

function saltFromB64(saltB64: string): Uint8Array {
  const buf = Buffer.from(saltB64, "base64");
  if (buf.length < 16) throw new Error("sync_bad_salt");
  return new Uint8Array(buf);
}

function deriveMasterKey(password: string, saltB64: string, kdf: VaultStatusDTO["kdf"]): Uint8Array {
  const salt = saltFromB64(saltB64);
  const pw = new TextEncoder().encode(password);
  return argon2id(pw, salt, {
    m: kdf.memory,
    t: kdf.iterations,
    p: kdf.parallelism,
    dkLen: kdf.keyLength,
  });
}

function hkdfKey(masterKey: Uint8Array, salt: Uint8Array, info: string, len: number): Buffer {
  return Buffer.from(
    crypto.hkdfSync("sha256", masterKey, salt, Buffer.from(info, "utf8"), len),
  );
}

function bearerTokenHex(masterKey: Uint8Array, salt: Uint8Array): string {
  const secret = hkdfKey(masterKey, salt, "ishtarkati-sync-bearer-v1", 32);
  return Buffer.from(secret).toString("hex");
}

function tokenHashHexFromBearer(bearerHex: string): string {
  return crypto.createHash("sha256").update(bearerHex, "utf8").digest("hex");
}

type EnvelopeV1 = {
  v: 1;
  alg: "aes-256-gcm";
  nonce: string;
  ciphertext: string;
  tag: string;
};

function encryptBackupJson(plaintextUtf8: string, masterKey: Uint8Array, salt: Uint8Array): string {
  const key = hkdfKey(masterKey, salt, "ishtarkati-sync-payload-v1", 32);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const c1 = cipher.update(plaintextUtf8, "utf8");
  const c2 = cipher.final();
  const tag = cipher.getAuthTag();
  const env: EnvelopeV1 = {
    v: 1,
    alg: "aes-256-gcm",
    nonce: nonce.toString("base64"),
    ciphertext: Buffer.concat([c1, c2]).toString("base64"),
    tag: tag.toString("base64"),
  };
  return JSON.stringify(env);
}

function decryptBackupJson(envelopeJson: string, masterKey: Uint8Array, salt: Uint8Array): string {
  let env: EnvelopeV1;
  try {
    env = JSON.parse(envelopeJson) as EnvelopeV1;
  } catch {
    throw new Error("sync_bad_envelope");
  }
  if (env.v !== 1 || env.alg !== "aes-256-gcm") throw new Error("sync_unsupported_cipher");
  const key = hkdfKey(masterKey, salt, "ishtarkati-sync-payload-v1", 32);
  const nonce = Buffer.from(env.nonce, "base64");
  const ciphertext = Buffer.from(env.ciphertext, "base64");
  const tag = Buffer.from(env.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function fetchCapabilities(baseUrl: string): Promise<CapabilitiesDTO> {
  const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/capabilities`;
  const res = await fetch(u, { method: "GET" });
  if (!res.ok) throw new Error(`sync_capabilities_http_${res.status}`);
  return (await res.json()) as CapabilitiesDTO;
}

async function fetchVaultStatus(baseUrl: string, vaultId: string): Promise<VaultStatusDTO> {
  const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults/${encodeURIComponent(vaultId)}/status`;
  const res = await fetch(u, { method: "GET" });
  if (res.status === 404) throw new Error("sync_vault_not_found");
  if (!res.ok) throw new Error(`sync_status_http_${res.status}`);
  return (await res.json()) as VaultStatusDTO;
}

async function fetchVaultLookup(
  baseUrl: string,
  name: string,
): Promise<{ vault_id: string; display_name: string }> {
  const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults/lookup?name=${encodeURIComponent(name)}`;
  const res = await fetch(u);
  if (res.status === 404) throw new Error("sync_name_not_found");
  if (res.status === 400) throw new Error("sync_invalid_name");
  if (!res.ok) throw new Error(`sync_lookup_http_${res.status}`);
  return (await res.json()) as { vault_id: string; display_name: string };
}

/** Parse JSON `{ "error": "code" }` from sync API failure responses. */
async function syncErrorFromResponse(res: Response, fallback: string): Promise<string> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return fallback;
  }
  try {
    const j = JSON.parse(text) as { error?: string };
    const code = typeof j.error === "string" ? j.error.trim() : "";
    if (!code) return fallback;
    if (code === "name_taken") return "sync_name_taken";
    if (code === "invalid_display_name") return "sync_invalid_display_name";
    return code;
  } catch {
    return fallback;
  }
}

function assertClientAllowed(appVersion: string, cap: CapabilitiesDTO, status: VaultStatusDTO): void {
  if (!semverGte(appVersion, cap.min_client_semver)) {
    throw new Error("sync_need_app_update_capabilities");
  }
  if (!semverGte(appVersion, status.min_client_semver)) {
    throw new Error("sync_need_app_update_vault");
  }
  if (BACKUP_EXPORT_VERSION > cap.max_backup_export_version) {
    throw new Error("sync_export_version_too_new");
  }
  if (BACKUP_EXPORT_VERSION > status.max_backup_export_version) {
    throw new Error("sync_export_version_too_new_vault");
  }
}

function setSession(vaultId: string, password: string, status: VaultStatusDTO): SessionPayload {
  const salt = saltFromB64(status.salt_b64);
  const masterKeyU = deriveMasterKey(password, status.salt_b64, status.kdf);
  const masterKey = Buffer.from(masterKeyU);
  const bearerHex = bearerTokenHex(masterKeyU, salt);
  const p = { masterKey, bearerHex };
  sessionByVault.set(vaultId, p);
  return p;
}

export function registerSyncIpc(
  getDb: () => Database.Database | null,
  getAppVersion: GetAppVersion,
): void {
  resolveAppVersion = getAppVersion;
  ipcMain.handle("sync:getLocalConfig", async () => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    return {
      ok: true as const,
      baseUrl: dbGet(database, SYNC_BASE_URL) ?? "",
      vaultId: dbGet(database, SYNC_VAULT_ID) ?? "",
      displayName: dbGet(database, SYNC_VAULT_DISPLAY_NAME) ?? "",
      serverRevision: dbGet(database, SYNC_SERVER_REVISION) ?? "",
      sessionUnlocked: (() => {
        const vid = dbGet(database, SYNC_VAULT_ID);
        return vid ? sessionByVault.has(vid) : false;
      })(),
    };
  });

  ipcMain.handle("sync:saveLocalConfig", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; vaultId?: string; displayName?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const vaultId = typeof o.vaultId === "string" ? o.vaultId.trim() : "";
    if (baseUrl) dbSet(database, SYNC_BASE_URL, baseUrl);
    else dbDel(database, SYNC_BASE_URL);
    if (vaultId) dbSet(database, SYNC_VAULT_ID, vaultId);
    else dbDel(database, SYNC_VAULT_ID);
    if ("displayName" in o) {
      const d = typeof o.displayName === "string" ? o.displayName.trim() : "";
      if (d) dbSet(database, SYNC_VAULT_DISPLAY_NAME, d);
      else dbDel(database, SYNC_VAULT_DISPLAY_NAME);
    }
    sessionByVault.clear();
    return { ok: true as const };
  });

  ipcMain.handle("sync:unlockSession", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object")
      return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; vaultId?: string; password?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const vaultId = typeof o.vaultId === "string" ? o.vaultId.trim() : "";
    const password = typeof o.password === "string" ? o.password : "";
    if (!baseUrl || !vaultId || !password) return { ok: false as const, error: "sync_missing_fields" };
    try {
      const cap = await fetchCapabilities(baseUrl);
      const status = await fetchVaultStatus(baseUrl, vaultId);
      assertClientAllowed(getAppVersion(), cap, status);
      setSession(vaultId, password, status);
      const dn = typeof status.display_name === "string" ? status.display_name.trim() : "";
      if (dn) dbSet(database, SYNC_VAULT_DISPLAY_NAME, dn);
      return { ok: true as const, status };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("sync:clearSession", async () => {
    sessionByVault.clear();
    return { ok: true as const };
  });

  ipcMain.handle("sync:capabilities", async (_evt, raw: unknown) => {
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const baseUrl = typeof (raw as { baseUrl?: string }).baseUrl === "string"
      ? (raw as { baseUrl: string }).baseUrl
      : "";
    if (!baseUrl.trim()) return { ok: false as const, error: "sync_missing_base" };
    try {
      const cap = await fetchCapabilities(baseUrl);
      return { ok: true as const, cap };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("sync:lookupVaultByName", async (_evt, raw: unknown) => {
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; name?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!baseUrl || !name.trim()) return { ok: false as const, error: "sync_missing_fields" };
    try {
      const resolved = await fetchVaultLookup(baseUrl, name);
      return {
        ok: true as const,
        vaultId: resolved.vault_id,
        displayName: resolved.display_name,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("sync:createVault", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; password?: string; displayName?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const password = typeof o.password === "string" ? o.password : "";
    const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
    if (!baseUrl || password.length < 8) return { ok: false as const, error: "sync_weak_password" };
    if (displayName.length < 2) return { ok: false as const, error: "sync_display_name_required" };

    const salt = crypto.randomBytes(32);
    const saltB64 = Buffer.from(salt).toString("base64");
    const masterKeyU = argon2id(new TextEncoder().encode(password), salt, {
      m: DEFAULT_KDF.memory,
      t: DEFAULT_KDF.iterations,
      p: DEFAULT_KDF.parallelism,
      dkLen: DEFAULT_KDF.keyLength,
    });
    const masterKey = Buffer.from(masterKeyU);
    const bearerHex = bearerTokenHex(masterKeyU, salt);
    const tokenHashHex = tokenHashHexFromBearer(bearerHex);

    const cap = await fetchCapabilities(baseUrl);
    const appVersion = getAppVersion();
    if (!semverGte(appVersion, cap.min_client_semver)) {
      return { ok: false as const, error: "sync_need_app_update_capabilities" };
    }
    if (BACKUP_EXPORT_VERSION > cap.max_backup_export_version) {
      return { ok: false as const, error: "sync_export_version_too_new" };
    }

    const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults`;
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        salt_b64: saltB64,
        kdf: {
          memory: DEFAULT_KDF.memory,
          iterations: DEFAULT_KDF.iterations,
          parallelism: DEFAULT_KDF.parallelism,
          keyLength: DEFAULT_KDF.keyLength,
        },
        token_hash_hex: tokenHashHex,
        min_client_semver: cap.min_client_semver,
        max_backup_export_version: cap.max_backup_export_version,
      }),
    });
    if (!res.ok) {
      const fallback = `sync_create_http_${res.status}`;
      return { ok: false as const, error: await syncErrorFromResponse(res, fallback) };
    }
    const created = (await res.json()) as { vault_id: string; display_name?: string };
    const resolvedName =
      typeof created.display_name === "string" && created.display_name.trim()
        ? created.display_name.trim()
        : displayName;
    if (!created.vault_id) return { ok: false as const, error: "sync_create_bad_response" };

    dbSet(database, SYNC_BASE_URL, baseUrl.trim());
    dbSet(database, SYNC_VAULT_ID, created.vault_id);
    dbSet(database, SYNC_VAULT_DISPLAY_NAME, resolvedName);
    dbSet(database, SYNC_SERVER_REVISION, "0");
    sessionByVault.set(created.vault_id, { masterKey, bearerHex });

    return { ok: true as const, vaultId: created.vault_id, displayName: resolvedName };
  });

  ipcMain.handle("sync:remoteStatus", async (_evt, raw: unknown) => {
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; vaultId?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const vaultId = typeof o.vaultId === "string" ? o.vaultId.trim() : "";
    if (!baseUrl || !vaultId) return { ok: false as const, error: "sync_missing_fields" };
    try {
      const cap = await fetchCapabilities(baseUrl);
      const status = await fetchVaultStatus(baseUrl, vaultId);
      assertClientAllowed(getAppVersion(), cap, status);
      return { ok: true as const, cap, status };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("sync:pullPreview", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const o = raw as { baseUrl?: string; vaultId?: string; password?: string };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const vaultId = typeof o.vaultId === "string" ? o.vaultId.trim() : "";
    const password = typeof o.password === "string" ? o.password : "";
    if (!baseUrl || !vaultId) return { ok: false as const, error: "sync_missing_fields" };

    try {
      const cap = await fetchCapabilities(baseUrl);
      const status = await fetchVaultStatus(baseUrl, vaultId);
      assertClientAllowed(getAppVersion(), cap, status);

      if (!status.has_snapshot) {
        return { ok: false as const, error: "sync_no_snapshot" };
      }

      let sess = sessionByVault.get(vaultId);
      if (!sess && password) {
        sess = setSession(vaultId, password, status);
      }
      if (!sess) return { ok: false as const, error: "sync_need_password_or_unlock" };

      const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults/${encodeURIComponent(vaultId)}/snapshot`;
      const res = await fetch(u, {
        headers: { Authorization: `Bearer ${sess.bearerHex}` },
      });
      if (res.status === 401) return { ok: false as const, error: "sync_unauthorized" };
      if (!res.ok) return { ok: false as const, error: `sync_pull_http_${res.status}` };

      const envText = await res.text();
      const salt = saltFromB64(status.salt_b64);
      const mk = new Uint8Array(sess.masterKey);
      const plain = decryptBackupJson(envText, mk, salt);
      const data = parseBackupJson(plain);
      const preview: ImportPreviewDTO = buildImportPreview(database, "sync://remote", data);
      return {
        ok: true as const,
        preview,
        backupJson: plain,
        serverRevision: status.revision,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("sync:recordPulledRevision", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const rev = String((raw as { revision?: unknown }).revision ?? "");
    if (!rev) return { ok: false as const, error: "sync_bad_revision" };
    dbSet(database, SYNC_SERVER_REVISION, rev);
    return { ok: true as const };
  });

  ipcMain.handle("sync:push", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "invalid" };
    const o = raw as {
      baseUrl?: string;
      vaultId?: string;
      password?: string;
      expectedRevision?: string | number;
      scope?: "full" | "without_settings";
    };
    const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
    const vaultId = typeof o.vaultId === "string" ? o.vaultId.trim() : "";
    const password = typeof o.password === "string" ? o.password : "";
    const scope = o.scope === "without_settings" ? "without_settings" : "full";
    if (!baseUrl || !vaultId) return { ok: false as const, error: "sync_missing_fields" };

    try {
      const cap = await fetchCapabilities(baseUrl);
      const status = await fetchVaultStatus(baseUrl, vaultId);
      assertClientAllowed(getAppVersion(), cap, status);

      let sess = sessionByVault.get(vaultId);
      if (!sess && password) {
        sess = setSession(vaultId, password, status);
      }
      if (!sess) return { ok: false as const, error: "sync_need_password_or_unlock" };

      const localRevStr = dbGet(database, SYNC_SERVER_REVISION);
      if (
        (localRevStr == null || localRevStr.trim() === "") &&
        status.has_snapshot &&
        status.revision > 0
      ) {
        return {
          ok: false as const,
          error: "sync_pull_required_first",
        };
      }

      let expectedRev: number;
      if (o.expectedRevision !== undefined && o.expectedRevision !== "") {
        expectedRev = parseInt(String(o.expectedRevision), 10);
        if (!Number.isFinite(expectedRev)) expectedRev = status.revision;
      } else {
        const local = dbGet(database, SYNC_SERVER_REVISION);
        expectedRev =
          local != null && local !== "" && Number.isFinite(parseInt(local, 10))
            ? parseInt(local, 10)
            : status.revision;
      }

      const payload = buildBackupPayloadFromDatabase(database, scope);
      const plain = JSON.stringify(payload);
      const salt = saltFromB64(status.salt_b64);
      const mk = new Uint8Array(sess.masterKey);
      const body = encryptBackupJson(plain, mk, salt);

      const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults/${encodeURIComponent(vaultId)}/snapshot`;
      const res = await fetch(u, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.bearerHex}`,
          "X-Expected-Revision": String(expectedRev),
        },
        body,
      });

      if (res.status === 401) return { ok: false as const, error: "sync_unauthorized" };
      if (res.status === 409) {
        let detail = "";
        try {
          const j = (await res.json()) as { current_revision?: number };
          detail =
            j.current_revision !== undefined ? `|current=${j.current_revision}` : "";
        } catch {
          /* ignore */
        }
        return { ok: false as const, error: `sync_conflict${detail}`, conflict: true as const };
      }
      if (!res.ok) return { ok: false as const, error: `sync_push_http_${res.status}` };

      const out = (await res.json()) as { revision?: number };
      const newRev = out.revision;
      if (newRev !== undefined) {
        dbSet(database, SYNC_SERVER_REVISION, String(newRev));
      }
      return { ok: true as const, revision: newRev };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });
}

/** Call after local DB writes to schedule an encrypted upload (needs unlock session). */
export function notifyLocalDataChanged(getDb: () => Database.Database | null): void {
  if (autoPushTimer) clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(() => {
    autoPushTimer = null;
    void attemptAutoPush(getDb, resolveAppVersion);
  }, AUTOPUSH_MS);
}

async function attemptAutoPush(
  getDb: () => Database.Database | null,
  getAppVersion: GetAppVersion,
): Promise<void> {
  const database = getDb();
  if (!database) return;
  const baseUrl = dbGet(database, SYNC_BASE_URL);
  const vaultId = dbGet(database, SYNC_VAULT_ID);
  if (!baseUrl || !vaultId) return;
  const sess = sessionByVault.get(vaultId);
  if (!sess) return;

  try {
    const cap = await fetchCapabilities(baseUrl);
    const status = await fetchVaultStatus(baseUrl, vaultId);
    assertClientAllowed(getAppVersion(), cap, status);

    const localRevStr = dbGet(database, SYNC_SERVER_REVISION);
    if (
      (localRevStr == null || localRevStr.trim() === "") &&
      status.has_snapshot &&
      status.revision > 0
    ) {
      return;
    }

    const local = dbGet(database, SYNC_SERVER_REVISION);
    const expectedRev =
      local != null && local !== "" && Number.isFinite(parseInt(local, 10))
        ? parseInt(local, 10)
        : status.revision;

    const payload = buildBackupPayloadFromDatabase(database, "full");
    const plain = JSON.stringify(payload);
    const salt = saltFromB64(status.salt_b64);
    const mk = new Uint8Array(sess.masterKey);
    const body = encryptBackupJson(plain, mk, salt);

    const u = `${normalizeSyncBaseUrl(baseUrl)}/v1/vaults/${encodeURIComponent(vaultId)}/snapshot`;
    const res = await fetch(u, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.bearerHex}`,
        "X-Expected-Revision": String(expectedRev),
      },
      body,
    });

    if (res.ok) {
      const out = (await res.json()) as { revision?: number };
      if (out.revision !== undefined) {
        dbSet(database, SYNC_SERVER_REVISION, String(out.revision));
      }
      return;
    }

    if (res.status === 409 && Notification.isSupported()) {
      new Notification({
        title: "إشتراكاتي — المزامنة",
        body: "تعارض في نسخة السيرفر. افتح الإعدادات › المزامنة لدمج التحديثات.",
      }).show();
    }
  } catch {
    /* ignore background errors */
  }
}
