import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export const priceTableSchema = z.enum(["atacado", "varejo_10", "varejo_75"]);

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  document: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
});

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  cost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

const sellerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  active: z.boolean().default(true),
});

const orderItemSchema = z.object({
  catalog_product_id: z.string().uuid(),
  code: z.string(),
  description: z.string(),
  image_url: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  ipi_percent: z.coerce.number().min(0).default(0),
  st_percent: z.coerce.number().min(0).default(0),
});

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: orderStatusSchema.default("pending"),
  price_table: priceTableSchema.default("varejo_10"),
  items: z.array(orderItemSchema).min(1),
});

// Dashboard stats
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { count: customersCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: productsCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: sellersCount } = await supabase
      .from("sellers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: ordersCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { data: recentOrders } = await supabase
      .from("order_summary")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      customersCount: customersCount ?? 0,
      productsCount: productsCount ?? 0,
      sellersCount: sellersCount ?? 0,
      ordersCount: ordersCount ?? 0,
      recentOrders: recentOrders ?? [],
    };
  });

// Customers
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => customerSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      document: data.document || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
    };

    if (data.id) {
      const { data: result, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return result;
    }

    const { data: result, error } = await supabase
      .from("customers")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const lookupCnpj = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ cnpj: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      throw new Error("CNPJ inválido. Digite os 14 números.");
    }
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("CNPJ não encontrado.");
      }
      throw new Error("Não foi possível consultar o CNPJ agora.");
    }
    const info: any = await res.json();

    const street = [
      info.descricao_tipo_de_logradouro,
      info.logradouro,
      info.numero,
      info.complemento,
      info.bairro ? `- ${info.bairro}` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const phone = info.ddd_telefone_1
      ? info.ddd_telefone_1
      : info.telefone1 || "";

    return {
      document: digits,
      name: info.nome_fantasia || info.razao_social || "",
      email: info.email || "",
      phone,
      address: street,
      city: info.municipio || "",
      state: info.uf || "",
    };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// Products
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => productSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      name: data.name,
      description: data.description || null,
      sku: data.sku || null,
      price: data.price,
      cost: data.cost,
      stock: data.stock,
      active: data.active,
    };

    if (data.id) {
      const { data: result, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return result;
    }

    const { data: result, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// Sellers
export const listSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sellerSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      active: data.active,
    };

    if (data.id) {
      const { data: result, error } = await supabase
        .from("sellers")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return result;
    }

    const { data: result, error } = await supabase
      .from("sellers")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sellers")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// Orders
export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("order_summary")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "*, customer:customers(id, name, document, phone, email, address, city, state, price_table), seller:sellers(id, name, phone, email)"
      )
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", data.id)
      .order("code");
    if (itemsError) throw new Error(itemsError.message);

    return {
      order: {
        ...order,
        customer_name: order.customer?.name ?? null,
        seller_name: order.seller?.name ?? null,
      },
      items: items ?? [],
    };
  });

export const upsertOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const computed = data.items.map((item) => {
      const base = item.quantity * item.unit_price;
      const ipi_value = (base * item.ipi_percent) / 100;
      const st_value = (base * item.st_percent) / 100;
      return { item, base, ipi_value, st_value };
    });

    const subtotal = computed.reduce((s, c) => s + c.base, 0);
    const ipi_total = computed.reduce((s, c) => s + c.ipi_value, 0);
    const st_total = computed.reduce((s, c) => s + c.st_value, 0);
    const total = subtotal + ipi_total + st_total;

    const orderPayload = {
      user_id: userId,
      customer_id: data.customer_id,
      seller_id: data.seller_id,
      status: data.status,
      price_table: data.price_table,
      subtotal,
      ipi_total,
      st_total,
      total,
    };

    let orderId = data.id;

    if (orderId) {
      const { error } = await supabase
        .from("orders")
        .update(orderPayload)
        .eq("id", orderId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);

      await supabase.from("order_items").delete().eq("order_id", orderId);
    } else {
      const { data: inserted, error } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      orderId = inserted.id;
    }

    const itemsPayload = computed.map(({ item, base, ipi_value, st_value }) => ({
      order_id: orderId!,
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
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload);
    if (itemsError) throw new Error(itemsError.message);

    return { id: orderId };
  });

// Catalog
export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ search: z.string().optional() }).parse(data ?? {})
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let query = supabase
      .from("catalog_products")
      .select("*")
      .eq("active", true)
      .order("code")
      .limit(60);
    const term = (data.search ?? "").trim();
    if (term) {
      query = query.or(
        `code.ilike.%${term}%,ref.ilike.%${term}%,description.ilike.%${term}%,barcode.ilike.%${term}%`
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: orderStatusSchema,
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
