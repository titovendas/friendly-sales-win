import { get, set, del } from "idb-keyval";
import { listCatalog, listCatalogAll } from "@/lib/sales.functions";

const CATALOG_KEY = "fv:catalog:v1";
const SYNCED_AT_KEY = "fv:catalog:syncedAt";

export type CatalogItem = {
  id: string;
  code: string;
  ref: string | null;
  description: string;
  barcode: string | null;
  ncm: string | null;
  category: string | null;
  image_url: string | null;
  ipi_percent: number;
  st_percent: number;
  price_atacado: number | null;
  price_varejo_10: number | null;
  price_varejo_75: number | null;
  active: boolean;
};

let syncInFlight: Promise<CatalogItem[]> | null = null;

/** Baixa o catálogo completo do servidor e grava no dispositivo. */
export async function syncCatalog(): Promise<CatalogItem[]> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const rows = (await listCatalogAll()) as CatalogItem[];
    await set(CATALOG_KEY, rows);
    await set(SYNCED_AT_KEY, new Date().toISOString());
    return rows;
  })();
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

/** Sincroniza em segundo plano, sem travar a tela, se estiver online. */
export function syncCatalogInBackground() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  syncCatalog().catch(() => {
    /* sem internet ou erro momentâneo: mantém a cópia local existente */
  });
}

export async function getCatalogSyncedAt(): Promise<string | null> {
  return (await get(SYNCED_AT_KEY)) ?? null;
}

export async function getOfflineCatalogCount(): Promise<number> {
  const rows = (await get<CatalogItem[]>(CATALOG_KEY)) ?? [];
  return rows.length;
}

export async function clearOfflineCatalog() {
  await del(CATALOG_KEY);
  await del(SYNCED_AT_KEY);
}

function matchesSearch(item: CatalogItem, term: string) {
  const t = term.toLowerCase();
  return (
    item.code?.toLowerCase().includes(t) ||
    item.ref?.toLowerCase().includes(t) ||
    item.description?.toLowerCase().includes(t) ||
    item.barcode?.toLowerCase().includes(t)
  );
}

/**
 * Busca produtos no catálogo. Tenta o servidor primeiro (dados sempre
 * atualizados); se estiver offline ou a chamada falhar, cai para a cópia
 * local salva no aparelho. Também mantém a cópia local sempre em dia
 * quando a busca acontece com internet.
 */
export async function searchCatalog(search: string): Promise<{
  items: CatalogItem[];
  fromCache: boolean;
}> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  if (isOnline) {
    try {
      const rows = (await listCatalog({ data: { search } })) as CatalogItem[];
      return { items: rows, fromCache: false };
    } catch {
      // segue para o fallback local abaixo
    }
  }

  const cached = (await get<CatalogItem[]>(CATALOG_KEY)) ?? [];
  const term = search.trim();
  const filtered = term
    ? cached.filter((item) => matchesSearch(item, term))
    : cached.slice(0, 60);
  return { items: filtered, fromCache: true };
}
