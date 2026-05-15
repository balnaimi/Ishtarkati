package api

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mrn/ishtarkati/sync-server/internal/store"
)

func TestCapabilities_OK(t *testing.T) {
	dir := t.TempDir()
	h := &Handler{
		Store:           store.NewFileStore(dir),
		APIVersion:      1,
		ServerSemver:    "9.9.9-test",
		MinClientSemver: "1.0.0",
		MaxBackupExport: 6,
		MaxUploadBytes:  1024,
	}
	srv := httptest.NewServer(h.Routes())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/v1/capabilities")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d", res.StatusCode)
	}
	var body struct {
		APIVersion             int    `json:"api_version"`
		MinClientSemver        string `json:"min_client_semver"`
		MaxBackupExportVersion int    `json:"max_backup_export_version"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.APIVersion != 1 || body.MaxBackupExportVersion != 6 {
		t.Fatalf("%+v", body)
	}
}

func TestCreateVault_HTTPFlow(t *testing.T) {
	dir := t.TempDir()
	h := &Handler{
		Store:           store.NewFileStore(dir),
		APIVersion:      1,
		ServerSemver:    "1.0.0",
		MinClientSemver: "1.0.0",
		MaxBackupExport: 6,
		MaxUploadBytes:  1024,
	}
	srv := httptest.NewServer(h.Routes())
	t.Cleanup(srv.Close)

	salt := make([]byte, 32)
	for i := range salt {
		salt[i] = byte(i ^ 0x5a)
	}
	payload := map[string]any{
		"display_name":             "حاوية تجريبية",
		"salt_b64":                 base64.StdEncoding.EncodeToString(salt),
		"token_hash_hex":           strings.Repeat("3c", 32),
		"min_client_semver":        "1.0.0",
		"max_backup_export_version": 6,
		"kdf": map[string]any{
			"memory":      65536,
			"iterations":  3,
			"parallelism": 4,
			"keyLength":   32,
		},
	}
	raw, _ := json.Marshal(payload)
	res, err := http.Post(srv.URL+"/v1/vaults", "application/json", strings.NewReader(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("status %d body %s", res.StatusCode, string(b))
	}
	var out struct {
		VaultID     string `json:"vault_id"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.VaultID == "" {
		t.Fatal("no vault_id")
	}

	// status
	stRes, err := http.Get(srv.URL + "/v1/vaults/" + out.VaultID + "/status")
	if err != nil {
		t.Fatal(err)
	}
	defer stRes.Body.Close()
	if stRes.StatusCode != http.StatusOK {
		t.Fatalf("status %d", stRes.StatusCode)
	}
}
