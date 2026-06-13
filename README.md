# Ishtarkati

Arabic **desktop-only** app to track online subscriptions, renewals, and multi-currency payments with QAR estimates. It does **not** run on phones or tablets. Distribution: **Linux AppImage**, **Windows x64 (NSIS installer)**, **macOS Apple Silicon (DMG)** — Electron + **React** + **TypeScript** + **SQLite**, local only, no backend. No `.deb` bundle.

## Prerequisites (build machine)

You need **Node.js** (LTS 20+ recommended) and **npm**.

On minimal Linux distros, **electron-builder** may need **`xdg-utils`** (for `xdg-open`) when producing the AppImage. Example: `sudo apt install xdg-utils` on Debian/Ubuntu.

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs Vite + Electron in development mode.

## Production build

**Linux (local):**

```bash
npm run build
```

Runs TypeScript, Vite, then **electron-builder** AppImage. Output:

- `release/Ishtarkati-{version}-linux.AppImage`

**Windows x64 / macOS Apple Silicon** require the matching OS (or GitHub Actions — see below):

```bash
npm run build:win    # NSIS installer → release/Ishtarkati-{version}-win-x64-setup.exe
npm run build:mac    # DMG arm64 → release/Ishtarkati-{version}-mac-arm64.dmg
```

`npm run build:pack` is the same as `build:linux` without bumping the version.

Run the AppImage:

```bash
chmod +x release/Ishtarkati-*.AppImage
./release/Ishtarkati-*.AppImage
```

If an **old** AppImage (before 4.0.1) prints `libfuse.so.2` / FUSE errors, use the latest build or:

```bash
./scripts/run-appimage.sh
# or: APPIMAGE_EXTRACT_AND_RUN=1 ./release/Ishtarkati-*.AppImage
```

Emergency copy of your local database (before experiments):

```bash
./scripts/backup-user-db.sh
```

Machines that only **run** the AppImage do not need Node or a compiler toolchain.

### Data

SQLite database **`ishtarkati.db`** is stored under the Electron **userData** directory for your OS user (not next to the AppImage). Copying the AppImage to another machine does **not** copy your subscriptions unless you also copy that database manually.

## Versioning

Each production **`npm run build`** auto-bumps **PATCH** (e.g. `1.0.0` → `1.0.1`) in `package.json` and `src/version.ts` before packaging, so the AppImage name matches the in-app version.

- Rebuild without bumping (handy while iterating): **`npm run build:pack`**

**Auto-rebuild on save** (watches `src/` and `electron/`, runs `build:pack` after a short debounce):

```bash
npm run watch:build
```

Manual bump:

```bash
npm run version:bump -- patch   # or minor | major
```

Updates `package.json` and `src/version.ts`.

---

## GitHub Releases (all platforms)

Push a version tag to build Linux, Windows, and Mac on GitHub Actions and publish a Release:

```bash
git tag v4.9.0
git push origin v4.9.0
```

Artifacts also appear under the workflow run when using **Actions → Release → Run workflow**.

Unsigned Windows/macOS builds may show SmartScreen / Gatekeeper warnings until code signing is configured.

---

**English (short):** `npm run build` on Linux → **`release/*.AppImage`**. Tag `v*` on GitHub for Win + Mac builds. No Debian package by design.
