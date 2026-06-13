# Changelog

All notable changes to **Ishtarkati** are documented here before each release.  
Before `npm run build:release`, add bullets under **`[Unreleased]`** in **English**. The ship script promotes them to the version number and attaches them to the GitHub Release.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]


## [4.22.0] - 2026-06-13

### Changed
- Product README with screenshots, platform download icons, and stable `releases/latest/download/` asset names.
- Release artifacts use fixed filenames (`Ishtarkati-linux.AppImage`, etc.) so download links stay valid across versions.
- Dashboard UI: purple dark theme, sidebar navigation, redesigned Home and Accounts pages to match product screenshots (stat cards, cashflow chart, card-style subscription rows, summary bar).
- Default appearance is now dark instead of system.
## [4.21.0] - 2026-06-13

### Fixed
- Backup import now restores subscription `tags`, `trial_ends_on`, and `renewal_cancelled` (previously dropped on restore).

### Added
- Unit tests for scheduled and manual auto-backup (`electron/autoBackup.test.ts`) and v13 field round-trip in backup tests.
## [4.20.0] - 2026-06-13

### Fixed
- UI errors, backup failures, and desktop notifications now use the active interface language (via `formatUiError` and locale keys) instead of raw English internal messages.
- Fatal startup dialog and lazy-page loading text follow the saved app language.
## [4.19.1] - 2026-06-13

### Added
- **Release notes workflow**: each GitHub Release shows changes from `CHANGELOG.md` and `release-notes/vX.Y.Z.md` automatically.

## [4.19.0] - 2026-06-07

### Added
- **System tray**: closing the window keeps the app running in the background with Show / Quit menu.
- **Background reminders**: notifications for due-today items and an upcoming-due digest (even when the window is hidden).
- **Automatic backup**: configurable folder and interval under Settings → Backup & export.
- **Command palette** (`Ctrl+K`): quick navigation and account search.
- **Keyboard shortcuts**: `n` new account, `?` shortcuts help.
- **Due today card** on Home with a view-all action.
- **Optional monthly budget** with progress bar on Home.
- **Duplicate detection** when adding a similar account (title / site / email).
- **New fields**: trial end date, renewal cancelled flag, tags.
- **Change audit log** for price, name, and currency on the detail page.
- **Appearance**: light / dark / system — persisted in the database.
- **Update check** against GitHub Releases in Settings.
- **Database schema v13**: `trial_ends_on`, `renewal_cancelled`, `subscription_audit_log` table.

### Changed
- On Linux, closing the window no longer quits the app when the tray is active.
