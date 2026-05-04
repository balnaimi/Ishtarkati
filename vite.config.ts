import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const _dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // better-sqlite3 pulls in `bindings`, which uses __filename — breaks when bundled as ESM
              external: ["better-sqlite3"],
            },
          },
        },
      },
      preload: { input: path.join(_dirname, "electron/preload.ts") },
      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
  ],
});
