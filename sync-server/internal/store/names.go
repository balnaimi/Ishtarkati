package store

import (
	"errors"
	"strings"
	"unicode"
)

var ErrInvalidDisplayName = errors.New("invalid display name")

// NormalizeVaultDisplayName trims, collapses whitespace, and validates length.
func NormalizeVaultDisplayName(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if len(s) < 2 {
		return "", ErrInvalidDisplayName
	}
	if len(s) > 120 {
		return "", ErrInvalidDisplayName
	}
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return "", ErrInvalidDisplayName
	}
	out := strings.Join(fields, " ")
	for _, r := range out {
		if unicode.IsControl(r) {
			return "", ErrInvalidDisplayName
		}
	}
	return out, nil
}

// NameIndexKey returns a case-insensitive key used in the name index.
func NameIndexKey(displayName string) (string, error) {
	norm, err := NormalizeVaultDisplayName(displayName)
	if err != nil {
		return "", err
	}
	return strings.ToLower(norm), nil
}
