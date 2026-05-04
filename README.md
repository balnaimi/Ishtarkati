# Ishtarkati

Arabic desktop app to track online subscriptions, renewals, and multi-currency payments with QAR estimates. Built with Tauri 2, React, TypeScript, and SQLite (local only, no backend).

## Prerequisites

### جهاز البناء (حيث تشغّل `npm run tauri build`)

على **لينكس 64-bit (مثل Debian / Ubuntu)** تحتاج تثبيت:

1. **Node.js** (مثلاً LTS 20+) و **npm** — من الموقع الرسمي أو مدير الحزم.
2. **Rust** — `rustup` من [rust-lang.org](https://www.rust-lang.org/tools/install) (يضيف `cargo` و `rustc`).
3. **اعتماديات Tauri لسطح مكتب لينكس** — مكتبات التطوير (GTK / WebKit…). اتبع الدليل الرسمي:  
   [Tauri v2 — Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux)  
   على أوبنتو/ديبيان يُذكر عادة تثبيت حزم مثل `build-essential`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` (قد تختلف الأسماء قليلًا حسب إصدار التوزيعة).
4. **لاستخراج AppImage:** على بعض التوزيعات الـ minimal يلزم **`xdg-utils`** (يوفر `xdg-open` الذي يستخدمه أداة الدمج). مثلاً: `sudo apt install xdg-utils`

بعد ذلك من جذر المشروع:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # مرة واحدة
npm install
npm run tauri build
```

أول مرة لـ Rust قد يستغرق التحميل والبناء وقتًا أطول.

### جهاز التشغيل فقط (بعد نسخ الـ AppImage)

لا تحتاج Node ولا Rust. انسخ ملف **`*.AppImage`** من  
`src-tauri/target/release/bundle/appimage/` ثم:

```bash
chmod +x Ishtarkati_*_amd64.AppImage
./Ishtarkati_*_amd64.AppImage
```

- لينكس **x86_64** ومكتبات Gtk/WebKit كما في تطبيقات سطح المكتب العادية (معظم التوزيعات الحديثة جاهزة).
- إذا فشل التشغيل بسبب FUSE، جرّب:  
  `./Ishtarkati_*_amd64.AppImage --appimage-extract-and-run`
- بيانات التطبيق (قاعدة SQLite) تُحفظ على **كل جهاز** في مجلد بيانات المستخدم لذلك الجهاز؛ نسخ الـ AppImage وحده **لا** ينقل اشتراكاتك من جهاز لآخر إلا إذا نسخت ملف القاعدة يدويًا.

**ملاحظة:** إن ظهر خطأ مثل `xdg-open binary not found` أثناء بناء AppImage، ثبّت `xdg-utils` ثم أعد `npm run tauri build`.

**شاشة بيضاء أو رسالة `EGL_BAD_PARAMETER` في الطرفية:** التطبيق (على لينكس) يضبط تلقائيًا تعطيل تركيب WebKit المعجّل، تعطيل عارض DMA-BUF، وعلى جلسات **Wayland** يفرض تشغيل GTK عبر **X11/XWayland** (`GDK_BACKEND=x11`) ما لم تكن قد عيّنت `GDK_BACKEND` بنفسك. إن استمرت المشكلة جرّب جلسة **Xorg**، أو `LIBGL_ALWAYS_SOFTWARE=1 ./Ishtarkati_*.AppImage`، أو للعودة لتجربة Wayland الأصلية: `GDK_BACKEND=wayland ./Ishtarkati_*.AppImage`.

### سير عملك: build جديد بعد كل تعديل

بعد كل تعديل على الكود: `npm run tauri build` (واختياريًا `npm run version:bump -- patch` قبل البناء إن أردت رقم إصدار جديد)، ثم خذ ملف الـ **AppImage** الجديد من مجلد `bundle/appimage/` وانقله للجهاز الآخر واستبدل النسخة القديمة.

---

**English (short):** Build machine needs **Node + npm**, **Rust (rustup)**, and **Tauri Linux dev packages** (see official prerequisites link). The **other machine** only needs a compatible **64-bit Linux** userland to **run the AppImage**; it does not need Node/Rust. App data is stored per machine in the app data directory.  
**White window in the packaged app** was fixed by using a **relative Vite `base` in production** so JS/CSS load inside Tauri’s webview.

## Development

```bash
npm install
npm run tauri dev
```

## Production build (AppImage فقط)

```bash
npm run tauri build
```

يُنشَأ ملف **`*.AppImage`** تحت `src-tauri/target/release/bundle/appimage/`.

Run the AppImage:

```bash
chmod +x Ishtarkati_*_amd64.AppImage
./Ishtarkati_*_amd64.AppImage
```

## Versioning

- **`npm run version:bump -- patch|minor|major`** — يحدّث `package.json`، `src/version.ts`، `src-tauri/tauri.conf.json`، و`src-tauri/Cargo.toml`.
- **`npm run build`** runs `scripts/sync-version.mjs` first so the Tauri bundle version matches `package.json`.

## Data

SQLite database: `ishtarkati.db` under the app data directory (Tauri app data path).
