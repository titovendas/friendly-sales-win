import { get, set } from "idb-keyval";
import { listCustomers, listSellers } from "@/lib/sales.functions";

const CUSTOMERS_KEY = "fv:customers:v1";
const CUSTOMERS_SYNCED_AT_KEY = "fv:customers:syncedAt";
const SELLER_NAME_KEY = "fv:defaultSellerName";

let syncInFlight: Promise<any[]> | null = null;

export async function syncCustomers() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const rows = await listCustomers();
    await set(CUSTOMERS_KEY, rows);
    await set(CUSTOMERS_SYNCED_AT_KEY, new Date().toISOString());
    return rows;
  })();
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export function syncCustomersInBackground() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  syncCustomers().catch(() => {});
}

export async function getOfflineCustomers(): Promise<any[]> {
  return (await get<any[]>(CUSTOMERS_KEY)) ?? [];
}

export async function getCustomersSyncedAt(): Promise<string | null> {
  return (await get(CUSTOMERS_SYNCED_AT_KEY)) ?? null;
}

/** Cacheia o nome do vendedor padrão (o primeiro ativo), para poder
 * exibi-lo em pedidos criados offline, mesmo sem acesso ao servidor. */
export async function syncDefaultSellerName() {
  try {
    const sellers = await listSellers();
    const active = (sellers as any[]).find((s) => s.active) ?? sellers[0];
    if (active) await set(SELLER_NAME_KEY, active.name as string);
  } catch {
    /* offline ou erro momentâneo */
  }
}

export async function getDefaultSellerNameOffline(): Promise<string | null> {
  return (await get(SELLER_NAME_KEY)) ?? null;
}
