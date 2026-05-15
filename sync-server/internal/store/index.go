package store

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type nameIndexFile struct {
	V     int               `json:"v"`
	Names map[string]string `json:"names"`
}

func (s *FileStore) indexPath() string {
	return filepath.Join(s.root, "vault_name_index.json")
}

func (s *FileStore) loadIndexUnlocked() (nameIndexFile, error) {
	p := s.indexPath()
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nameIndexFile{V: 1, Names: map[string]string{}}, nil
		}
		return nameIndexFile{}, err
	}
	var idx nameIndexFile
	if err := json.Unmarshal(b, &idx); err != nil {
		return nameIndexFile{}, err
	}
	if idx.Names == nil {
		idx.Names = map[string]string{}
	}
	if idx.V == 0 {
		idx.V = 1
	}
	return idx, nil
}

func (s *FileStore) saveIndexUnlocked(idx nameIndexFile) error {
	return writeJSON(s.indexPath(), idx)
}

// LookupVaultIDByName resolves a display name to vault UUID (case-insensitive).
func (s *FileStore) LookupVaultIDByName(displayName string) (string, error) {
	key, err := NameIndexKey(displayName)
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	idx, err := s.loadIndexUnlocked()
	if err != nil {
		return "", err
	}
	id, ok := idx.Names[key]
	if !ok {
		return "", ErrNotFound
	}
	return id, nil
}
