# Ishtarkati

Arabic **desktop-only** app to track online subscriptions, renewals, and multi-currency payments with QAR estimates. It does **not** run on phones or tablets; distribution is **Linux AppImage** (Electron + **React** + **TypeScript** + **SQLite**, local only, no backend). No `.deb` bundle.

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

## Production build (Linux AppImage only)

```bash
npm run build
```

This runs TypeScript checking, Vite production build, then **electron-builder** with target **`AppImage` only**. Output directory:

- `release/Ishtarkati-1.0.0.AppImage` (version follows `package.json`).

Run the AppImage:

```bash
chmod +x release/Ishtarkati-*.AppImage
./release/Ishtarkati-*.AppImage
```

If FUSE-related errors appear on some systems:

```bash
./release/Ishtarkati-*.AppImage --appimage-extract-and-run
```

Machines that only **run** the AppImage do not need Node or a compiler toolchain.

### Data

SQLite database **`ishtarkati.db`** is stored under the Electron **userData** directory for your OS user (not next to the AppImage). Copying the AppImage to another machine does **not** copy your subscriptions unless you also copy that database manually.

## Versioning

**كل مرة تشغّل إنتاج build** (`npm run build`) يتم **رفع رقم PATCH تلقائياً** (مثلاً `1.0.0` → `1.0.1`) وتحديث `package.json` و`src/version.ts` قبل التجميع، فيتطابق اسم الـ AppImage مع ما يظهر في التطبيق.

- لتجاوز الرفع وإعادة تجهيز AppImage دون تغيير رقم الإصدار (مناسب للتكرار أثناء التطوير):  
  **`npm run build:pack`**

**بناء تلقائي عند كل حفظ للملفات المصدرية** (مراقبة `src/` و`electron/` ثم تشغيل `build:pack` بعد ثوانٍ من آخر تعديل):

```bash
npm run watch:build
```

يدويًا:

```bash
npm run version:bump -- patch   # or minor | major
```

Updates `package.json` and `src/version.ts`.

---

**English (short):** Build with `npm run build`; grab **`*.AppImage`** from **`release/`**. No Debian package is produced by design.
