package store

import (
	"encoding/base64"
	"strings"
	"testing"
)

func salt32B64() string {
	b := make([]byte, 32)
	for i := range b {
		b[i] = byte(i)
	}
	return base64.StdEncoding.EncodeToString(b)
}

func hex64() string {
	return strings.Repeat("ab", 32)
}

func TestCreateVault_Minimal(t *testing.T) {
	dir := t.TempDir()
	s := NewFileStore(dir)
	meta, err := s.CreateVault(CreateVaultInput{
		DisplayName:            "اختبار",
		SaltB64:                salt32B64(),
		KDF:                    KDFParams{Memory: 65536, Iterations: 3, Parallelism: 4, KeyLength: 32},
		TokenHashHex:           hex64(),
		MinClientSemver:        "1.0.0",
		MaxBackupExportVersion: 6,
	})
	if err != nil {
		t.Fatal(err)
	}
	if meta.VaultID == "" {
		t.Fatal("empty vault id")
	}
	got, has, err := s.GetStatus(meta.VaultID)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		// fresh vault
	}
	if got.DisplayName != meta.DisplayName {
		t.Fatalf("display name %q vs %q", got.DisplayName, meta.DisplayName)
	}
}

func TestCreateVault_NameTaken(t *testing.T) {
	dir := t.TempDir()
	s := NewFileStore(dir)
	in := CreateVaultInput{
		DisplayName:            "نفس الاسم",
		SaltB64:                salt32B64(),
		KDF:                    KDFParams{Memory: 65536, Iterations: 3, Parallelism: 4, KeyLength: 32},
		TokenHashHex:           hex64(),
		MinClientSemver:        "1.0.0",
		MaxBackupExportVersion: 6,
	}
	if _, err := s.CreateVault(in); err != nil {
		t.Fatal(err)
	}
	in.TokenHashHex = strings.Repeat("cd", 32)
	_, err := s.CreateVault(in)
	if err != ErrNameTaken {
		t.Fatalf("want ErrNameTaken, got %v", err)
	}
}

func TestCreateVault_InvalidTokenLen(t *testing.T) {
	dir := t.TempDir()
	s := NewFileStore(dir)
	_, err := s.CreateVault(CreateVaultInput{
		DisplayName:            "اختبار",
		SaltB64:                salt32B64(),
		KDF:                    KDFParams{Memory: 65536, Iterations: 3, Parallelism: 4, KeyLength: 32},
		TokenHashHex:           "dead",
		MinClientSemver:        "1.0.0",
		MaxBackupExportVersion: 6,
	})
	if err != ErrInvalidTokenHashHex {
		t.Fatalf("want ErrInvalidTokenHashHex, got %v", err)
	}
}

func TestLookupVaultIDByName(t *testing.T) {
	dir := t.TempDir()
	s := NewFileStore(dir)
	name := "اسم للبحث"
	_, err := s.CreateVault(CreateVaultInput{
		DisplayName:            name,
		SaltB64:                salt32B64(),
		KDF:                    KDFParams{Memory: 65536, Iterations: 3, Parallelism: 4, KeyLength: 32},
		TokenHashHex:           hex64(),
		MinClientSemver:        "1.0.0",
		MaxBackupExportVersion: 6,
	})
	if err != nil {
		t.Fatal(err)
	}
	id, err := s.LookupVaultIDByName(name)
	if err != nil {
		t.Fatal(err)
	}
	if id == "" {
		t.Fatal("empty id")
	}
	_, err = s.LookupVaultIDByName("مافي")
	if err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
