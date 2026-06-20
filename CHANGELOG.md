# Changelog

All notable changes to **Ishtarkati** are documented here before each release.  
Before `npm run build:release`, add bullets under **`[Unreleased]`** in **English**. The ship script promotes them to the version number and attaches them to the GitHub Release.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]


## [4.34.0] - 2026-06-20

### Added
- In-app rebrand to **Hesabati** (AR: **حساباتي**) with tagline «Digital account organizer».
- Account platform type: **website** / **app** / **both**.
- Optional login fields: username, email, phone; optional recovery contact (email or phone).

### Changed
- Add/edit form: unified «Account details» section — fill only what applies.
- Backup export version 7 (includes new identity fields).
## [4.33.3] - 2026-06-19

### Added
- Home dashboard: «Recently added accounts» panel below «Needs your attention», showing the latest active accounts.
## [4.33.2] - 2026-06-15

### Fixed
- macOS DMG: ad-hoc code signing on CI to reduce false “app is damaged” Gatekeeper errors on first launch.

### Changed
- README: macOS first-launch steps (`xattr -cr`) when Gatekeeper blocks unsigned downloads.
## [4.33.1] - 2026-06-14

### Changed
- Cashflow and Insights labels no longer say «estimate» — totals are summed from each subscription’s scheduled due dates in the calendar period (Jan 1–Dec 31 for the year).
## [4.33.0] - 2026-06-14

### Removed
- Accounts list «monthly total (approx.)» — misleading with mixed billing cycles; use Home or Insights for actual due amounts per period.
## [4.32.1] - 2026-06-14

### Fixed
- Accounts list «monthly total (approx.)» now normalizes recurring billing intervals to a monthly equivalent instead of summing raw payment amounts.
## [4.32.0] - 2026-06-14

### Added
- Close-window choice: run in background (system tray) or quit completely; optional remember preference; default asks each time. Configurable in Settings.
## [4.31.3] - 2026-06-14

### Changed
- About dialog copy updated with revised project story (Arabic and English).
## [4.31.2] - 2026-06-14

### Changed
- Scrollbars styled to match light/dark theme (cream and violet tones).
- Update check runs on startup and every 5 minutes while the app is open (background polls do not flash "checking" in the sidebar).
## [4.31.1] - 2026-06-14

### Added
- About dialog from the sidebar (and mobile footer) with the project story and GitHub link.
## [4.31.0] - 2026-06-13

### Added
- Tags settings tab: manage vocabulary, stats, rename/delete; tag picker in forms; filter, badges, and search (including command palette).
- Automatic update check when online: sidebar version status, startup prompt for new releases, dialog with download link and release notes (Arabic notes when `release-notes/vX.Y.Z.ar.md` exists).

### Changed
- Tags are cross-cutting labels (multiple per account); categories remain the single structural grouping per account.
## [4.29.1] - 2026-06-13

### Changed
- README download section: direct release links only (removed custom platform icons and outdated screenshots).
## [4.29.0] - 2026-06-13

### Changed
- Unified button styles app-wide: violet primary, outline secondary, consistent danger/muted/toggle classes in light and dark themes.
- PIN screen, onboarding, and all dialogs use theme-aware `sk-dialog-panel` with readable text colors.
## [4.28.0] - 2026-06-13

### Changed
- Insights (spending & calendar) redesigned to match the home dashboard: compact stats, panels, calendar grid, and payment history list.
- Payment methods, settings, detail, and subscription forms use the same dash-page layout with tighter spacing.
## [4.27.0] - 2026-06-13

### Changed
- Home page redesign: balanced two-column layout, compact stats, action-first attention panel (due today, due soon, expiring cards), streamlined cashflow and payment snapshots.
## [4.25.0] - 2026-06-13

### Changed
- Sidebar stays fixed to the viewport height; main content scrolls independently (theme toggle always visible).
- Accounts list uses compact table-style rows with sticky search/filters and summary bar for easier browsing of many subscriptions.
## [4.23.0] - 2026-06-13

### Fixed
- Light/dark theme contrast: dashboard shell background, tag/status colors, modal overlays, and hint text now adapt correctly in both appearance modes.
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
