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
import { ErrorBoundary } from "./components/ErrorBoundary";

if (typeof localStorage !== "undefined" && localStorage.getItem("ishtarkati_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
