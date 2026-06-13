# Locale bundles (`src/locales/`)

User-visible copy lives here, separate from TypeScript. The app supports **Arabic (`ar`)** and **English (`en`)**.

| File | Purpose |
|------|--------|
| `ar.json` / `en.json` | UI strings: navigation, forms, settings, onboarding, errors, payment catalog labels, etc. |
| `currencies.ar.json` / `currencies.en.json` | ISO 4217 codes → localized currency names (`currencies.<CODE>`). |

Runtime: `src/i18n/index.ts` loads both languages and merges each UI bundle with its currency map.

Persistence: `app_language` in SQLite settings (+ `ishtarkati_lang` in `localStorage` for fast boot). Helpers: `src/lib/appLocale.ts`, `src/lib/i18nLabels.ts`.

**Electron** (`electron/uiLocale.ts`) reads `app_language` for context-menu and backup dialog titles (`electron.*` keys).

To add UI text: extend **both** `ar.json` and `en.json`, then use `t("…")` in React.
