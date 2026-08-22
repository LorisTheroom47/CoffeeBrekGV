"use server";

import { createHash } from "node:crypto";
import {
  type CreateOrderErrorCode,
  type CreateOrderFieldErrors,
  type CreateOrderInput,
  type CreateOrderResult,
  type ValidatedCreateOrderInput,
  validateCreateOrderInput,
} from "@/lib/orders";
import { verifyTurnstileToken } from "@/lib/orders/turnstile";
import { createOrderServerSupabaseClient } from "@/lib/supabase/order-server";

const MAXIMUM_PAYLOAD_BYTES = 32 * 1024;

const errorMessages: Readonly<Record<CreateOrderErrorCode, string>> = {
  INVALID_CUSTOMER_DATA: "Controlla i dati inseriti.",
  INVALID_FULFILLMENT: "Seleziona consegna o ritiro.",
  INVALID_ITEMS: "Controlla i piatti e le quantità.",
  ITEM_NOT_AVAILABLE: "Uno o più piatti non sono più disponibili.",
  INVALID_REQUEST_DATE: "Seleziona una data valida.",
  REQUEST_TOO_LARGE:
    "La richiesta è troppo grande. Riduci il contenuto e riprova.",
  TOO_MANY_REQUESTS:
    "Hai effettuato troppi tentativi. Riprova tra qualche minuto.",
  SECURITY_CHECK_FAILED:
    "Impossibile completare la verifica di sicurezza. Riprova.",
  IDEMPOTENCY_CONFLICT:
    "Impossibile completare questa richiesta. Avvia un nuovo ordine e riprova.",
  INVALID_REQUEST:
    "Impossibile inviare la richiesta. Controlla i dati e riprova.",
  ORDER_CREATION_FAILED: "Impossibile creare l’ordine. Riprova.",
};

const knownRpcErrorCodes = new Set<CreateOrderErrorCode>([
  "INVALID_CUSTOMER_DATA",
  "INVALID_FULFILLMENT",
  "INVALID_ITEMS",
  "ITEM_NOT_AVAILABLE",
  "INVALID_REQUEST_DATE",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_CREATION_FAILED",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const moneyPattern = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
const orderNumberPattern = /^[1-9]\d*$/;

function failure(
  code: CreateOrderErrorCode,
  fieldErrors?: CreateOrderFieldErrors,
): CreateOrderResult {
  return {
    success: false,
    code,
    message: errorMessages[code],
    ...(fieldErrors && Object.keys(fieldErrors).length > 0
      ? { fieldErrors }
      : {}),
  };
}

function validationErrorCode(
  fieldErrors: CreateOrderFieldErrors,
): CreateOrderErrorCode {
  if (fieldErrors.fulfillmentType) {
    return "INVALID_FULFILLMENT";
  }

  if (fieldErrors.requestedDate) {
    return "INVALID_REQUEST_DATE";
  }

  if (fieldErrors.items) {
    return "INVALID_ITEMS";
  }

  if (fieldErrors.turnstileToken) {
    return "SECURITY_CHECK_FAILED";
  }

  if (fieldErrors.idempotencyKey) {
    return "INVALID_REQUEST";
  }

  return "INVALID_CUSTOMER_DATA";
}

function rpcErrorCode(message: string): CreateOrderErrorCode {
  return knownRpcErrorCodes.has(message as CreateOrderErrorCode)
    ? (message as CreateOrderErrorCode)
    : "ORDER_CREATION_FAILED";
}

function payloadSizeInBytes(input: unknown): number | null {
  try {
    const serialized = JSON.stringify(input);
    return serialized === undefined
      ? null
      : new TextEncoder().encode(serialized).byteLength;
  } catch {
    return null;
  }
}

function honeypotIsClear(input: unknown): boolean {
  if (!isRecord(input) || !("website" in input)) return true;
  return typeof input.website === "string" && input.website.trim() === "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOrderNumber(value: unknown): string | null {
  if (typeof value === "string" && orderNumberPattern.test(value)) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }

  return null;
}

function normalizeMoney(value: unknown): string | null {
  const rawValue =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;

  if (rawValue === null || !moneyPattern.test(rawValue)) {
    return null;
  }

  const [euros, cents = ""] = rawValue.split(".");
  return `${euros}.${cents.padEnd(2, "0")}`;
}

function parseRpcResult(data: unknown): CreateOrderResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  const row = data[0];
  const orderId = row.order_id;
  const orderNumber = normalizeOrderNumber(row.order_number);
  const total = normalizeMoney(row.total);

  if (
    typeof orderId !== "string" ||
    !uuidPattern.test(orderId) ||
    orderNumber === null ||
    total === null
  ) {
    return null;
  }

  return {
    success: true,
    orderId,
    orderNumber,
    total,
  };
}

function createRequestFingerprint(
  input: ValidatedCreateOrderInput,
): string {
  const canonicalPayload = {
    fulfillmentType: input.fulfillmentType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    deliveryPoint: input.deliveryPoint,
    requestedDate: input.requestedDate,
    requestedTime: input.requestedTime,
    customerNotes: input.customerNotes,
    items: input.items
      .map((item) => ({
        menuItemId: item.menuItemId.toLowerCase(),
        quantity: item.quantity,
        customerNotes: item.customerNotes,
      }))
      .sort((first, second) =>
        first.menuItemId.localeCompare(second.menuItemId),
      ),
  };

  return createHash("sha256")
    .update(JSON.stringify(canonicalPayload), "utf8")
    .digest("hex");
}

export async function createPublicOrderAction(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const payloadSize = payloadSizeInBytes(input);

  if (payloadSize === null) {
    return failure("INVALID_REQUEST");
  }

  if (payloadSize > MAXIMUM_PAYLOAD_BYTES) {
    return failure("REQUEST_TOO_LARGE");
  }

  if (!honeypotIsClear(input)) {
    return failure("INVALID_REQUEST");
  }

  const validation = validateCreateOrderInput(input);

  if (!validation.success) {
    return failure(
      validationErrorCode(validation.fieldErrors),
      validation.fieldErrors,
    );
  }

  if (!(await verifyTurnstileToken(validation.data.turnstileToken))) {
    return failure("SECURITY_CHECK_FAILED");
  }

  const values = validation.data;
  const requestFingerprint = createRequestFingerprint(values);
  const rpcPayload = {
    p_fulfillment_type: values.fulfillmentType,
    p_customer_name: values.customerName,
    p_customer_phone: values.customerPhone,
    p_requested_date: values.requestedDate,
    p_items: values.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      customer_notes: item.customerNotes,
    })),
    p_customer_email: values.customerEmail,
    p_delivery_point: values.deliveryPoint,
    p_requested_time: values.requestedTime,
    p_customer_notes: values.customerNotes,
    p_idempotency_key: values.idempotencyKey,
    p_request_fingerprint: requestFingerprint,
  };

  try {
    const supabase = createOrderServerSupabaseClient();
    const { data, error } = await supabase.rpc(
      "create_public_order",
      rpcPayload,
    );

    if (error) {
      return failure(rpcErrorCode(error.message));
    }

    return parseRpcResult(data) ?? failure("ORDER_CREATION_FAILED");
  } catch {
    return failure("ORDER_CREATION_FAILED");
  }
}
