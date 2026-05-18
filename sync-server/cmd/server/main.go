package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mrn/ishtarkati/sync-server/internal/api"
	"github.com/mrn/ishtarkati/sync-server/internal/store"
	"github.com/mrn/ishtarkati/sync-server/internal/version"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		addr := api.EnvString("SYNC_HEALTH_URL", "http://127.0.0.1:8080/health")
		resp, err := http.Get(addr)
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		_ = resp.Body.Close()
		os.Exit(0)
	}

	dataDir := api.EnvString("SYNC_DATA_DIR", "/data")
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		log.Fatal(err)
	}
	addr := api.EnvString("SYNC_LISTEN_ADDR", ":8080")
	srvVer := version.Semver()
	if override := api.EnvString("SYNC_SERVER_SEMVER", ""); override != "" {
		srvVer = override
	}
	h := &api.Handler{
		Store:            store.NewFileStore(filepath.Clean(dataDir)),
		APIVersion:       api.EnvInt("SYNC_API_VERSION", 1),
		ServerSemver:     srvVer,
		MinClientSemver:  api.EnvString("SYNC_MIN_CLIENT_SEMVER", "1.0.0"),
		MaxBackupExport:  api.EnvInt("SYNC_MAX_BACKUP_EXPORT_VERSION", 6),
		MaxUploadBytes:   api.EnvInt64("SYNC_MAX_UPLOAD_BYTES", 52_428_800), // 50 MiB
	}
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Mount("/", h.Routes())
	log.Printf("ishtarkati-sync %s listening on %s data=%s", srvVer, addr, dataDir)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
