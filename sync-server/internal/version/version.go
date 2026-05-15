package version

import (
	"strings"

	_ "embed"
)

//go:embed VERSION
var embedded string

// Semver is the sync-server release (major.minor.patch), kept in lockstep with the desktop app.
func Semver() string {
	return strings.TrimSpace(embedded)
}
