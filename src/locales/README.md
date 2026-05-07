# Locale bundles (`src/locales/`)

This folder holds **all user-visible Arabic copy** for the default (`ar`) language, kept separate from TypeScript so code stays English-only.

| File | Purpose |
|------|--------|
| `ar.json` | UI strings: navigation, forms, settings, errors, payment catalog labels (`paymentCatalog.services.*`, `paymentCatalog.brands.*`), etc. Keys are English dot-paths (e.g. `settings.title`). |
| `currencies.ar.json` | ISO 4217 currency codes → Arabic names. Loaded into i18n as `currencies.<CODE>` (e.g. `currencies.QAR`). |

Runtime wiring: `src/i18n/index.ts` merges `ar.json` and `currencies.ar.json` into a single `translation` resource.

Helpers: `src/lib/i18nLabels.ts` (`tCurrency`, `tPaymentService`, `tCardBrand`).

**Electron** (`electron/main.ts`, `electron/backup.ts`) imports `ar.json` for context-menu and backup dialog titles (`electron.*` keys).

To add UI text: extend `ar.json`, then use `t("…")` in React or `i18n.t` where hooks are unavailable.
