import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Crucible",
        short_name: "Crucible",
        description: "Simple and effective progressive overload",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
  },
  // wa-sqlite ships a .wasm that must be served as-is; Vite's dep optimizer
  // rewrites the relative path and the dev server returns index.html instead,
  // causing "expected magic word 00 61 73 6d, found 3c 21 44 4f" (<!DO...).
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
  server: {
    host: "0.0.0.0",
  },
});
