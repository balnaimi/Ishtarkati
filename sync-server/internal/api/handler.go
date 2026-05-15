package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mrn/ishtarkati/sync-server/internal/store"
)

type Handler struct {
	Store               *store.FileStore
	APIVersion          int
	ServerSemver        string
	MinClientSemver     string
	MaxBackupExport     int
	MaxUploadBytes      int64
}

type capabilitiesResp struct {
	APIVersion              int    `json:"api_version"`
	ServerSemver            string `json:"server_semver"`
	MinClientSemver         string `json:"min_client_semver"`
	MaxBackupExportVersion  int    `json:"max_backup_export_version"`
}

type createVaultReq struct {
	SaltB64                string          `json:"salt_b64"`
	KDF                    store.KDFParams `json:"kdf"`
	TokenHashHex           string          `json:"token_hash_hex"`
	MinClientSemver        string          `json:"min_client_semver"`
	MaxBackupExportVersion int             `json:"max_backup_export_version"`
}

type createVaultResp struct {
	VaultID string `json:"vault_id"`
}

type statusResp struct {
	VaultID                string          `json:"vault_id"`
	Revision               int64           `json:"revision"`
	UpdatedAt              string          `json:"updated_at"`
	HasSnapshot            bool            `json:"has_snapshot"`
	SaltB64                string          `json:"salt_b64"`
	KDF                    store.KDFParams `json:"kdf"`
	MinClientSemver        string          `json:"min_client_semver"`
	MaxBackupExportVersion int             `json:"max_backup_export_version"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/health", h.health)
	r.Get("/v1/capabilities", h.capabilities)
	r.Post("/v1/vaults", h.createVault)
	r.Get("/v1/vaults/{vaultID}/status", h.status)
	r.Put("/v1/vaults/{vaultID}/snapshot", h.putSnapshot)
	r.Get("/v1/vaults/{vaultID}/snapshot", h.getSnapshot)
	return r
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":        "ok",
		"server_semver": h.ServerSemver,
	})
}

func (h *Handler) capabilities(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(capabilitiesResp{
		APIVersion:             h.APIVersion,
		ServerSemver:           h.ServerSemver,
		MinClientSemver:        h.MinClientSemver,
		MaxBackupExportVersion: h.MaxBackupExport,
	})
}

func (h *Handler) createVault(w http.ResponseWriter, r *http.Request) {
	var req createVaultReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.SaltB64) == "" || strings.TrimSpace(req.TokenHashHex) == "" {
		http.Error(w, `{"error":"missing_fields"}`, http.StatusBadRequest)
		return
	}
	meta, err := h.Store.CreateVault(store.CreateVaultInput{
		SaltB64:                req.SaltB64,
		KDF:                    req.KDF,
		TokenHashHex:           req.TokenHashHex,
		MinClientSemver:        req.MinClientSemver,
		MaxBackupExportVersion: req.MaxBackupExportVersion,
	})
	if err != nil {
		http.Error(w, `{"error":"create_failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createVaultResp{VaultID: meta.VaultID})
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "vaultID")
	meta, has, err := h.Store.GetStatus(id)
	if err == store.ErrNotFound {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(statusResp{
		VaultID:                meta.VaultID,
		Revision:               meta.Revision,
		UpdatedAt:              meta.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
		HasSnapshot:            has,
		SaltB64:                meta.SaltB64,
		KDF:                    meta.KDF,
		MinClientSemver:        meta.MinClientSemver,
		MaxBackupExportVersion: meta.MaxBackupExportVersion,
	})
}

func bearer(r *http.Request) string {
	a := r.Header.Get("Authorization")
	if a == "" {
		return ""
	}
	const p = "Bearer "
	if len(a) > len(p) && strings.EqualFold(a[:len(p)], p) {
		return strings.TrimSpace(a[len(p):])
	}
	return ""
}

func (h *Handler) putSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "vaultID")
	tok := bearer(r)
	if tok == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	expRaw := r.Header.Get("X-Expected-Revision")
	if expRaw == "" {
		expRaw = r.Header.Get("If-Match")
	}
	expRev, err := strconv.ParseInt(strings.TrimSpace(expRaw), 10, 64)
	if err != nil {
		http.Error(w, `{"error":"bad_expected_revision"}`, http.StatusBadRequest)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, h.MaxUploadBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"too_large"}`, http.StatusRequestEntityTooLarge)
		return
	}
	meta, err := h.Store.PutSnapshot(id, tok, expRev, body)
	if err == store.ErrNotFound {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	if err == store.ErrUnauthorized {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	if err == store.ErrConflict {
		cur, _, _ := h.Store.GetStatus(id)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":             "revision_conflict",
			"expected_revision": expRev,
			"current_revision":  cur.Revision,
		})
		return
	}
	if err != nil {
		http.Error(w, `{"error":"write_failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"revision":  meta.Revision,
		"updated_at": meta.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
	})
}

func (h *Handler) getSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "vaultID")
	tok := bearer(r)
	if tok == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	b, meta, err := h.Store.GetSnapshot(id, tok)
	if err == store.ErrNotFound {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	if err == store.ErrUnauthorized {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Sync-Revision", strconv.FormatInt(meta.Revision, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

// Server options from env
func EnvInt64(key string, def int64) int64 {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return def
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return v
}

func EnvInt(key string, def int) int {
	return int(EnvInt64(key, int64(def)))
}

func EnvString(key, def string) string {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return def
	}
	return s
}
