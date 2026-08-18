import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  AdminOrderDetail,
  AdminOrderItemDetail,
  AdminOrderSummary,
} from "./admin-types";

type RawAdminOrderSummary = {
  id: string;
  order_number: string | number;
  fulfillment_type: string;
  status: string;
  customer_name: string;
  requested_date: string;
  requested_time: string | null;
  total: string | number | null;
  created_at: string;
};

type RawAdminOrderDetail = {
  id: string;
  order_number: string | number;
  fulfillment_type: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_postal_code: string | null;
  requested_date: string;
  requested_time: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  subtotal: string | number | null;
  delivery_fee: string | number | null;
  total: string | number | null;
  created_at: string;
};

type RawAdminOrderItemDetail = {
  id: string;
  item_name: string;
  unit_price: string | number | null;
  quantity: number;
  line_total: string | number | null;
  customer_notes: string | null;
};

export type AdminOrderDetailResult =
  | Readonly<{ status: "found"; order: AdminOrderDetail; items: AdminOrderItemDetail[] }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "error" }>;

function normalizeOrderNumber(value: string | number): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }

  return null;
}

export async function getNewAdminOrderCount(): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error || count === null) return null;

  return count;
}

export async function getAdminOrderSummaries(): Promise<
  AdminOrderSummary[]
> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, fulfillment_type, status, customer_name, requested_date, requested_time, total, created_at",
    )
    .order("created_at", { ascending: false })
    .order("order_number", { ascending: false });

  if (error) {
    throw new Error("Impossibile caricare gli ordini.");
  }

  return ((data ?? []) as RawAdminOrderSummary[]).map((order) => ({
    id: order.id,
    orderNumber: normalizeOrderNumber(order.order_number),
    fulfillmentType: order.fulfillment_type,
    status: order.status,
    customerName: order.customer_name,
    requestedDate: order.requested_date,
    requestedTime: order.requested_time,
    total: order.total,
    createdAt: order.created_at,
  }));
}

function optionalText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function getAdminOrderDetail(
  id: string,
): Promise<AdminOrderDetailResult> {
  const supabase = await createServerSupabaseClient();
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, fulfillment_type, status, customer_name, customer_phone, customer_email, delivery_address, delivery_city, delivery_postal_code, requested_date, requested_time, customer_notes, admin_notes, subtotal, delivery_fee, total, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (orderError) return { status: "error" };
  if (!orderData) return { status: "not_found" };

  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, item_name, unit_price, quantity, line_total, customer_notes, created_at",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: true })
    .order("item_name", { ascending: true })
    .order("id", { ascending: true });

  if (itemsError) return { status: "error" };

  const rawOrder = orderData as RawAdminOrderDetail;
  const order: AdminOrderDetail = {
    id: rawOrder.id,
    orderNumber: normalizeOrderNumber(rawOrder.order_number),
    fulfillmentType: rawOrder.fulfillment_type,
    status: rawOrder.status,
    customerName: rawOrder.customer_name,
    customerPhone: rawOrder.customer_phone,
    customerEmail: optionalText(rawOrder.customer_email),
    deliveryAddress: optionalText(rawOrder.delivery_address),
    deliveryCity: optionalText(rawOrder.delivery_city),
    deliveryPostalCode: optionalText(rawOrder.delivery_postal_code),
    requestedDate: rawOrder.requested_date,
    requestedTime: rawOrder.requested_time,
    customerNotes: optionalText(rawOrder.customer_notes),
    adminNotes: optionalText(rawOrder.admin_notes),
    subtotal: rawOrder.subtotal,
    deliveryFee: rawOrder.delivery_fee,
    total: rawOrder.total,
    createdAt: rawOrder.created_at,
  };
  const items = ((itemsData ?? []) as RawAdminOrderItemDetail[]).map(
    (item) => ({
      id: item.id,
      itemName: item.item_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.line_total,
      customerNotes: optionalText(item.customer_notes),
    }),
  );

  return { status: "found", order, items };
}
