// Service worker do Força de Vendas.
// Estratégia: network-first com fallback em cache, para páginas e arquivos
// do próprio app (mesma origem). Isso permite reabrir o app mesmo sem
// internet, desde que ele já tenha sido carregado alguma vez antes com
// conexão. Chamadas para outros domínios (Supabase, BrasilAPI etc.) não são
// interceptadas — seguem direto para a rede, como sempre.

const CACHE_NAME = "fv-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // outros domínios: não mexe

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        const cached = await cache.match(request, { ignoreSearch: false });
        if (cached) return cached;

        // Navegação (abrir uma tela) sem internet e sem cópia salva dessa
        // URL específica: tenta servir a última cópia da home como app
        // shell, para o roteador do lado do cliente assumir a partir daí.
        if (request.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        throw err;
      }
    })
  );
});
