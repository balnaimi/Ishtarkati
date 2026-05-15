package store

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("vault not found")
var ErrConflict = errors.New("revision conflict")
var ErrUnauthorized = errors.New("unauthorized")
var ErrNameTaken = errors.New("vault display name already in use")

type KDFParams struct {
	Memory      uint32 `json:"memory"`
	Iterations  uint32 `json:"iterations"`
	Parallelism uint8  `json:"parallelism"`
	KeyLength   uint32 `json:"keyLength"`
}

// VaultMeta is stored in plain JSON on disk (salt + token hash only; no password).
type VaultMeta struct {
	VaultID                string    `json:"vault_id"`
	DisplayName            string    `json:"display_name,omitempty"`
	Revision               int64     `json:"revision"`
	UpdatedAt              time.Time `json:"updated_at"`
	SaltB64                string    `json:"salt_b64"`
	KDF                    KDFParams `json:"kdf"`
	TokenHashHex           string    `json:"token_hash_hex"`
	MinClientSemver        string    `json:"min_client_semver"`
	MaxBackupExportVersion int       `json:"max_backup_export_version"`
	CreatedAt              time.Time `json:"created_at"`
}

type CreateVaultInput struct {
	SaltB64                string
	KDF                    KDFParams
	TokenHashHex           string
	MinClientSemver        string
	MaxBackupExportVersion int
	/** Optional friendly name; unique on this server (case-insensitive). */
	DisplayName string
}

type FileStore struct {
	root string
	mu   sync.Mutex
}

func NewFileStore(root string) *FileStore {
	return &FileStore{root: root}
}

func (s *FileStore) vaultDir(id string) string {
	return filepath.Join(s.root, "vaults", id)
}

func (s *FileStore) CreateVault(in CreateVaultInput) (*VaultMeta, error) {
	var displayStored string
	var nameKey string
	if strings.TrimSpace(in.DisplayName) != "" {
		norm, err := NormalizeVaultDisplayName(in.DisplayName)
		if err != nil {
			return nil, err
		}
		k, err := NameIndexKey(in.DisplayName)
		if err != nil {
			return nil, err
		}
		displayStored = norm
		nameKey = k
	}

	id := uuid.NewString()
	dir := s.vaultDir(id)
	s.mu.Lock()
	defer s.mu.Unlock()

	if nameKey != "" {
		idx, err := s.loadIndexUnlocked()
		if err != nil {
			return nil, err
		}
		if _, taken := idx.Names[nameKey]; taken {
			return nil, ErrNameTaken
		}
	}

	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	minV := strings.TrimSpace(in.MinClientSemver)
	if minV == "" {
		minV = "1.0.0"
	}
	maxExport := in.MaxBackupExportVersion
	if maxExport <= 0 {
		maxExport = 6
	}
	tokenHash := strings.ToLower(strings.TrimSpace(in.TokenHashHex))
	if len(tokenHash) != 64 {
		_ = os.RemoveAll(dir)
		return nil, fmt.Errorf("invalid token_hash_hex")
	}
	meta := VaultMeta{
		VaultID:                id,
		DisplayName:            displayStored,
		Revision:               0,
		UpdatedAt:              time.Now().UTC(),
		SaltB64:                in.SaltB64,
		KDF:                    in.KDF,
		TokenHashHex:           tokenHash,
		MinClientSemver:        minV,
		MaxBackupExportVersion: maxExport,
		CreatedAt:              time.Now().UTC(),
	}
	if err := writeJSON(filepath.Join(dir, "meta.json"), meta); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}

	if nameKey != "" {
		idx, err := s.loadIndexUnlocked()
		if err != nil {
			_ = os.RemoveAll(dir)
			return nil, err
		}
		if _, taken := idx.Names[nameKey]; taken {
			_ = os.RemoveAll(dir)
			return nil, ErrNameTaken
		}
		idx.Names[nameKey] = id
		if err := s.saveIndexUnlocked(idx); err != nil {
			_ = os.RemoveAll(dir)
			return nil, err
		}
	}

	return &meta, nil
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o640); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func (s *FileStore) loadMetaUnlocked(id string) (VaultMeta, error) {
	p := filepath.Join(s.vaultDir(id), "meta.json")
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return VaultMeta{}, ErrNotFound
		}
		return VaultMeta{}, err
	}
	var meta VaultMeta
	if err := json.Unmarshal(b, &meta); err != nil {
		return VaultMeta{}, err
	}
	return meta, nil
}

// GetStatus returns vault meta and whether an encrypted snapshot file exists.
func (s *FileStore) GetStatus(id string) (VaultMeta, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	meta, err := s.loadMetaUnlocked(id)
	if err != nil {
		return VaultMeta{}, false, err
	}
	snap := filepath.Join(s.vaultDir(id), "snapshot.enc.json")
	_, statErr := os.Stat(snap)
	has := statErr == nil
	return meta, has, nil
}

func tokenMatchesStored(storedHashHex, bearerToken string) bool {
	want, err := hex.DecodeString(strings.TrimSpace(storedHashHex))
	if err != nil || len(want) != sha256.Size {
		return false
	}
	h := sha256.Sum256([]byte(strings.TrimSpace(bearerToken)))
	return subtle.ConstantTimeCompare(want, h[:]) == 1
}

// PutSnapshot writes encrypted snapshot JSON if expectedRevision matches current server revision.
func (s *FileStore) PutSnapshot(id, bearerToken string, expectedRevision int64, body []byte) (VaultMeta, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	meta, err := s.loadMetaUnlocked(id)
	if err != nil {
		return VaultMeta{}, err
	}
	if !tokenMatchesStored(meta.TokenHashHex, bearerToken) {
		return VaultMeta{}, ErrUnauthorized
	}
	if expectedRevision != meta.Revision {
		return VaultMeta{}, ErrConflict
	}
	if len(body) == 0 {
		return VaultMeta{}, fmt.Errorf("empty body")
	}
	dir := s.vaultDir(id)
	snapPath := filepath.Join(dir, "snapshot.enc.json")
	tmp := snapPath + ".tmp"
	if err := os.WriteFile(tmp, body, 0o640); err != nil {
		return VaultMeta{}, err
	}
	if err := os.Rename(tmp, snapPath); err != nil {
		return VaultMeta{}, err
	}
	meta.Revision++
	meta.UpdatedAt = time.Now().UTC()
	if err := writeJSON(filepath.Join(dir, "meta.json"), meta); err != nil {
		return VaultMeta{}, err
	}
	return meta, nil
}

// GetSnapshot returns encrypted snapshot bytes (or ErrNotFound).
func (s *FileStore) GetSnapshot(id, bearerToken string) ([]byte, VaultMeta, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	meta, err := s.loadMetaUnlocked(id)
	if err != nil {
		return nil, VaultMeta{}, err
	}
	if !tokenMatchesStored(meta.TokenHashHex, bearerToken) {
		return nil, VaultMeta{}, ErrUnauthorized
	}
	snapPath := filepath.Join(s.vaultDir(id), "snapshot.enc.json")
	b, err := os.ReadFile(snapPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, meta, ErrNotFound
		}
		return nil, meta, err
	}
	return b, meta, nil
}
