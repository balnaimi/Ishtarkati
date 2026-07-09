/** SQLite settings keys — code identifiers in English. */

export const THEME_MODE_KEY = "theme_mode";
export const MONTHLY_BUDGET_LIMIT_KEY = "monthly_budget_limit";
export const AUTO_BACKUP_ENABLED_KEY = "auto_backup_enabled";
export const AUTO_BACKUP_DAYS_KEY = "auto_backup_days";
export const AUTO_BACKUP_DIR_KEY = "auto_backup_dir";
export const DEVICE_NAME_KEY = "device_name";
export const LAST_AUTO_BACKUP_AT_KEY = "last_auto_backup_at";
export const LAST_MANUAL_BACKUP_AT_KEY = "last_manual_backup_at";

/** Settings tied to this machine — never overwritten when restoring a backup from another device. */
export const DEVICE_LOCAL_SETTINGS_KEYS = [
  DEVICE_NAME_KEY,
  AUTO_BACKUP_DIR_KEY,
  LAST_AUTO_BACKUP_AT_KEY,
  LAST_MANUAL_BACKUP_AT_KEY,
] as const;
/** ask | tray | quit — when closing the main window */
export const CLOSE_ACTION_KEY = "close_action";
