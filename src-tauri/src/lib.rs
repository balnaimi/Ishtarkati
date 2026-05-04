#[cfg(target_os = "linux")]
fn linux_display_workarounds() {
    use std::env;

    // WebKitGTK + EGL often breaks on Wayland / Intel / Mesa → blank window + EGL_BAD_PARAMETER.
    if env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
        env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
    if env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    // Run GTK (and WebKit) through XWayland when on a Wayland session unless the user
    // already forced a backend (e.g. GDK_BACKEND=wayland).
    if env::var_os("GDK_BACKEND").is_none() && env::var_os("WAYLAND_DISPLAY").is_some() {
        env::set_var("GDK_BACKEND", "x11");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    linux_display_workarounds();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
