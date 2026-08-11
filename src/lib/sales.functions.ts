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
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
});

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: orderStatusSchema.default("pending"),
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

    const { data: monthlySales } = await supabase.rpc("get_monthly_sales", {
      p_user_id: userId,
    });

    return {
      customersCount: customersCount ?? 0,
      productsCount: productsCount ?? 0,
      sellersCount: sellersCount ?? 0,
      ordersCount: ordersCount ?? 0,
      recentOrders: recentOrders ?? [],
      monthlySales: monthlySales ?? [],
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
      .from("order_summary")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*, product:products(id, name)")
      .eq("order_id", data.id);
    if (itemsError) throw new Error(itemsError.message);

    return { order, items: items ?? [] };
  });

export const upsertOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const total = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    const orderPayload = {
      user_id: userId,
      customer_id: data.customer_id,
      seller_id: data.seller_id,
      status: data.status,
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

    const itemsPayload = data.items.map((item) => ({
      order_id: orderId!,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload);
    if (itemsError) throw new Error(itemsError.message);

    return { id: orderId };
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
