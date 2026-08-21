// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // O build gera os arquivos do navegador em dist/client, mas eles são
          // servidos a partir da raiz — sem isso o cache aponta para /client/...
          // e nada é encontrado quando o app abre sem internet.
          manifestTransforms: [
            (entries: { url: string }[]) => ({
              manifest: entries.map((entry) => ({
                ...entry,
                url: entry.url.replace(/^client\//, ""),
              })),
              warnings: [],
            }),
          ],
          // A home é pré-baixada na instalação e serve de "casca" do app
          // quando o usuário abre uma URL que ainda não foi visitada offline.
          additionalManifestEntries: [{ url: "/", revision: `${Date.now()}` }],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/_serverFn/, /^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,

          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) =>
                request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "fv-pages",
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
                sameOrigin && url.pathname.startsWith("/produtos/"),
              handler: "CacheFirst",
              options: {
                cacheName: "fv-fotos-produtos",
                expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
          ],
        },
      }),
    ],
  },
});
