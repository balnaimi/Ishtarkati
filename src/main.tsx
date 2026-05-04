import React from "react";
import ReactDOM from "react-dom/client";
/**
 * Self-hosted Tajawal (Google Fonts family); files are bundled into dist — no runtime fetch from Google.
 */
import "@fontsource/tajawal/300.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "./i18n";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
