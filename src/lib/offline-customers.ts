import { get, set } from "idb-keyval";
import {
  listCustomers,
  listSellers,
  listPaymentTerms,
  listCampaignItems,
  DEFAULT_PAYMENT_TERMS,
} from "@/lib/sales.functions";

const CUSTOMERS_KEY = "fv:customers:v1";
const CUSTOMERS_SYNCED_AT_KEY = "fv:customers:syncedAt";
const SELLER_NAME_KEY = "fv:defaultSellerName";
const PAYMENT_TERMS_KEY = "fv:paymentTerms:v1";
const CAMPAIGN_ITEMS_KEY = "fv:campaignItems:v1";

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

export async function syncPaymentTerms(): Promise<
  { id: string; label: string }[] | null
> {
  try {
    const rows = await listPaymentTerms();
    const simplified = rows.map((r) => ({ id: r.id, label: r.label }));
    await set(PAYMENT_TERMS_KEY, simplified);
    return simplified;
  } catch {
    return null;
  }
}

/** Lista de prazos de pagamento pronta pra usar em qualquer tela: tenta o
 * servidor, cai pra cópia local, e se nunca sincronizou nada ainda usa uma
 * pequena lista padrão de exemplo. */
export async function getPaymentTermsOfflineAware(): Promise<
  { id: string; label: string }[]
> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  if (isOnline) {
    const rows = await syncPaymentTerms();
    if (rows && rows.length > 0) return rows;
    if (rows && rows.length === 0) {
      return DEFAULT_PAYMENT_TERMS.map((label) => ({ id: label, label }));
    }
  }
  const cached = (await get<{ id: string; label: string }[]>(PAYMENT_TERMS_KEY)) ?? [];
  if (cached.length > 0) return cached;
  return DEFAULT_PAYMENT_TERMS.map((label) => ({ id: label, label }));
}

export type CampaignItemSimplified = {
  catalog_product_id: string | null;
  campaign_price: number;
};

export async function syncCampaignItems(): Promise<CampaignItemSimplified[] | null> {
  try {
    const rows = await listCampaignItems();
    const simplified = (rows as any[]).map((r) => ({
      catalog_product_id: r.catalog_product_id,
      campaign_price: Number(r.campaign_price),
    }));
    await set(CAMPAIGN_ITEMS_KEY, simplified);
    return simplified;
  } catch {
    return null;
  }
}

/** Mapa catalog_product_id -> preço de campanha, pronto para consulta
 * rápida ao montar um orçamento. Tenta o servidor, cai para a cópia local. */
export async function getCampaignPriceMapOfflineAware(): Promise<
  Map<string, number>
> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  let items: CampaignItemSimplified[] | null = null;
  if (isOnline) {
    items = await syncCampaignItems();
  }
  if (!items) {
    items = (await get<CampaignItemSimplified[]>(CAMPAIGN_ITEMS_KEY)) ?? [];
  }
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.catalog_product_id) map.set(item.catalog_product_id, item.campaign_price);
  }
  return map;
}
