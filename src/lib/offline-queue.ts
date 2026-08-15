import { get, set } from "idb-keyval";
import {
  listCustomers,
  listOrders,
  upsertCustomer,
  upsertOrder,
} from "@/lib/sales.functions";
import {
  getOfflineCustomers,
  syncCustomers,
  getDefaultSellerNameOffline,
} from "@/lib/offline-customers";

const PENDING_CUSTOMERS_KEY = "fv:pending:customers";
const PENDING_ORDERS_KEY = "fv:pending:orders";

export type OrderItemPayload = {
  catalog_product_id: string;
  code: string;
  description: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  ipi_percent: number;
  st_percent: number;
};

export type OrderPayload = {
  customer_id: string;
  status: string;
  price_table: string;
  payment_term?: string;
  items: OrderItemPayload[];
};

export type CustomerPayload = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  neighborhood?: string;
  zip_code?: string;
  city?: string;
  state?: string;
};

export type PendingCustomer = {
  localId: string;
  payload: CustomerPayload; // shape compatible with customerSchema (minus id)
  createdAt: string;
};

export type PendingOrder = {
  localId: string;
  payload: OrderPayload; // shape compatible with orderSchema (minus id)
  customerSnapshot: CustomerPayload | null;
  sellerNameSnapshot: string | null;
  totals: { subtotal: number; ipi_total: number; st_total: number; total: number };
  createdAt: string;
};

function genLocalId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${rand}`;
}

async function getPendingCustomers(): Promise<PendingCustomer[]> {
  return (await get<PendingCustomer[]>(PENDING_CUSTOMERS_KEY)) ?? [];
}

async function getPendingOrders(): Promise<PendingOrder[]> {
  return (await get<PendingOrder[]>(PENDING_ORDERS_KEY)) ?? [];
}

export async function listPendingCustomers() {
  return getPendingCustomers();
}

export async function listPendingOrders() {
  return getPendingOrders();
}

export async function queueCustomer(payload: CustomerPayload) {
  const pending = await getPendingCustomers();
  const record: PendingCustomer = {
    localId: genLocalId("local-cust"),
    payload,
    createdAt: new Date().toISOString(),
  };
  await set(PENDING_CUSTOMERS_KEY, [...pending, record]);
  return record;
}

export async function removePendingCustomer(localId: string) {
  const pending = await getPendingCustomers();
  await set(
    PENDING_CUSTOMERS_KEY,
    pending.filter((c) => c.localId !== localId)
  );
}

export function computeOrderTotals(items: OrderItemPayload[]) {
  let subtotal = 0;
  let ipi_total = 0;
  let st_total = 0;
  for (const item of items) {
    const base = item.quantity * item.unit_price;
    subtotal += base;
    ipi_total += (base * (item.ipi_percent || 0)) / 100;
    st_total += (base * (item.st_percent || 0)) / 100;
  }
  return {
    subtotal,
    ipi_total,
    st_total,
    total: subtotal + ipi_total + st_total,
  };
}

export async function queueOrder(
  payload: OrderPayload,
  customerSnapshot: CustomerPayload | null
) {
  const pending = await getPendingOrders();
  const sellerNameSnapshot = await getDefaultSellerNameOffline();
  const record: PendingOrder = {
    localId: genLocalId("local-order"),
    payload,
    customerSnapshot,
    sellerNameSnapshot,
    totals: computeOrderTotals(payload.items ?? []),
    createdAt: new Date().toISOString(),
  };
  await set(PENDING_ORDERS_KEY, [...pending, record]);
  return record;
}

export async function updatePendingOrder(
  localId: string,
  payload: OrderPayload,
  customerSnapshot: CustomerPayload | null
) {
  const pending = await getPendingOrders();
  const next = pending.map((o) =>
    o.localId === localId
      ? {
          ...o,
          payload,
          customerSnapshot: customerSnapshot ?? o.customerSnapshot,
          totals: computeOrderTotals(payload.items ?? []),
        }
      : o
  );
  await set(PENDING_ORDERS_KEY, next);
}

export async function removePendingOrder(localId: string) {
  const pending = await getPendingOrders();
  await set(
    PENDING_ORDERS_KEY,
    pending.filter((o) => o.localId !== localId)
  );
}

export async function getPendingOrder(localId: string) {
  const pending = await getPendingOrders();
  return pending.find((o) => o.localId === localId) ?? null;
}

export async function getPendingCustomer(localId: string) {
  const pending = await getPendingCustomers();
  return pending.find((c) => c.localId === localId) ?? null;
}

/**
 * Monta um pedido (com itens) para exibição/edição/PDF a partir de um id
 * qualquer: se for um pedido ainda não sincronizado (prefixo local-order-),
 * reconstrói a partir da fila local; caso contrário, busca no servidor.
 */
export async function getOrderForDisplay(id: string) {
  if (!id.startsWith("local-order-")) return null; // caller usa getOrder()

  const po = await getPendingOrder(id);
  if (!po) return null;

  const order = {
    id: po.localId,
    created_at: po.createdAt,
    customer_id: po.payload.customer_id,
    customer_name: po.customerSnapshot?.name ?? "—",
    customer: po.customerSnapshot,
    seller_name: po.sellerNameSnapshot,
    status: po.payload.status,
    price_table: po.payload.price_table,
    payment_term: po.payload.payment_term,
    subtotal: po.totals.subtotal,
    ipi_total: po.totals.ipi_total,
    st_total: po.totals.st_total,
    total: po.totals.total,
    __pending: true,
  };

  const items = (po.payload.items ?? []).map((item: any, index: number) => {
    const base = item.quantity * item.unit_price;
    const ipi_value = (base * (item.ipi_percent || 0)) / 100;
    const st_value = (base * (item.st_percent || 0)) / 100;
    return {
      id: `${po.localId}-item-${index}`,
      catalog_product_id: item.catalog_product_id,
      code: item.code,
      description: item.description,
      image_url: item.image_url ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      ipi_percent: item.ipi_percent,
      st_percent: item.st_percent,
      ipi_value,
      st_value,
      total: base + ipi_value + st_value,
    };
  });

  return { order, items };
}

export async function pendingCount() {
  const [customers, orders] = await Promise.all([
    getPendingCustomers(),
    getPendingOrders(),
  ]);
  return customers.length + orders.length;
}

/**
 * Lista de clientes pronta para exibir/usar em telas offline: tenta o
 * servidor; se falhar, usa a cópia local. Em ambos os casos, inclui os
 * clientes criados offline que ainda não foram sincronizados.
 */
export async function listCustomersMerged(): Promise<any[]> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  let base: any[] = [];
  if (isOnline) {
    try {
      base = await listCustomers();
    } catch {
      base = await getOfflineCustomers();
    }
  } else {
    base = await getOfflineCustomers();
  }

  const pending = await getPendingCustomers();
  const pendingAsCustomers = pending.map((c) => ({
    id: c.localId,
    ...c.payload,
    __pending: true,
  }));
  return [...pendingAsCustomers, ...base];
}

/**
 * Lista de pedidos para a tela de Pedidos: pedidos do servidor (quando
 * online) mais os pedidos ainda não sincronizados, sempre no topo.
 */
export async function listOrdersMerged(): Promise<any[]> {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  let base: any[] = [];
  if (isOnline) {
    try {
      base = await listOrders();
    } catch {
      base = [];
    }
  }

  const pending = await getPendingOrders();
  const pendingAsOrders = pending.map((po) => ({
    id: po.localId,
    created_at: po.createdAt,
    customer_name: po.customerSnapshot?.name ?? "—",
    seller_name: po.sellerNameSnapshot,
    status: po.payload.status,
    payment_term: po.payload.payment_term,
    total: po.totals.total,
    __pending: true,
  }));
  return [...pendingAsOrders, ...base];
}

/**
 * Sincroniza tudo que foi criado offline: primeiro os clientes (para obter
 * IDs reais), depois os pedidos (remapeando o cliente local para o real
 * quando necessário). Itens que falharem continuam na fila para a próxima
 * tentativa.
 */
export async function syncPendingData(): Promise<{
  syncedCustomers: number;
  syncedOrders: number;
  failed: number;
}> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { syncedCustomers: 0, syncedOrders: 0, failed: 0 };
  }

  let syncedCustomers = 0;
  let syncedOrders = 0;
  let failed = 0;

  // 1) Clientes pendentes primeiro, guardando o mapeamento local -> real
  const idMap = new Map<string, string>();
  const pendingCustomers = await getPendingCustomers();
  for (const pc of pendingCustomers) {
    try {
      const result = await upsertCustomer({ data: pc.payload });
      if (result?.id) idMap.set(pc.localId, result.id);
      await removePendingCustomer(pc.localId);
      syncedCustomers++;
    } catch {
      failed++;
    }
  }

  // 2) Pedidos pendentes, remapeando cliente local -> real se preciso
  const pendingOrders = await getPendingOrders();
  for (const po of pendingOrders) {
    try {
      let customerId = po.payload.customer_id as string;
      if (customerId?.startsWith("local-cust-")) {
        const realId = idMap.get(customerId);
        if (!realId) {
          // cliente ainda não sincronizado (falhou acima) — tenta depois
          failed++;
          continue;
        }
        customerId = realId;
      }
      await upsertOrder({
        data: { ...po.payload, customer_id: customerId },
      });
      await removePendingOrder(po.localId);
      syncedOrders++;
    } catch {
      failed++;
    }
  }

  if (syncedCustomers > 0) {
    syncCustomers().catch(() => {});
  }

  return { syncedCustomers, syncedOrders, failed };
}
