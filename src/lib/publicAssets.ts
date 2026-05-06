/**
 * أصول من `public/` تُنسَخ إلى جذر `dist/`.
 * يجب أن يكون المسار نسبيًا (يبدأ بـ `./`) ليعمل تحميل الصور مع `file://` في Electron،
 * وليس بصيغة `/…` التي تُفسَّر من جذر نظام الملفات.
 */
export const ISHTARKATI_MARK_SRC = "./ishtarkati-mark.svg";
