// @lovable.dev/vite-tanstack-config already includes TanStack Start, React, Tailwind, tsconfig paths,
// nitro (Cloudflare), env injection and sandbox detection — do NOT add those plugins again.
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // registration happens only in src/lib/pwa.ts (guarded)
        filename: "sw.js",
        // Never emit a service worker in dev: it would cache stale modules in the preview iframe.
        devOptions: { enabled: false },
        workbox: {
          navigateFallback: null,
          globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 4 },
            },
          ],
        },
        manifest: {
          name: "Artist Studio Workflow",
          short_name: "Studio",
          description: "Studio companion for a ceramic artist: capture, photo lab, inventory, and gallery consignments.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#faf7f2",
          theme_color: "#b4552d",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        },
      }),
    ],
  },
});
