import type {
  CreateOrderFieldErrors,
  CreateOrderInput,
  ValidatedCreateOrderInput,
} from "./types";

type ValidationResult =
  | { success: true; data: ValidatedCreateOrderInput }
  | { success: false; fieldErrors: CreateOrderFieldErrors };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(
  value: unknown,
  maximumLength: number,
): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.length <= maximumLength ? normalized : undefined;
}

function isRealDate(value: string): boolean {
  const match = datePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function getTodayInRome(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    calendar: "iso8601",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function normalizeTime(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const match = timePattern.exec(normalized);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return undefined;
  }

  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

export function validateCreateOrderInput(
  input: CreateOrderInput,
): ValidationResult {
  const rawInput: unknown = input;
  const fieldErrors: CreateOrderFieldErrors = {};

  if (!isRecord(rawInput)) {
    return {
      success: false,
      fieldErrors: { items: "Controlla i dati dell’ordine." },
    };
  }

  const fulfillmentType = rawInput.fulfillmentType;

  const idempotencyKey =
    typeof rawInput.idempotencyKey === "string"
      ? rawInput.idempotencyKey.trim().toLowerCase()
      : "";

  if (!uuidV4Pattern.test(idempotencyKey)) {
    fieldErrors.idempotencyKey = "Impossibile inviare l’ordine. Riprova.";
  }

  if (fulfillmentType !== "delivery" && fulfillmentType !== "pickup") {
    fieldErrors.fulfillmentType = "Seleziona consegna o ritiro.";
  }

  const customerName =
    typeof rawInput.customerName === "string"
      ? rawInput.customerName.trim()
      : "";
  const customerPhone =
    typeof rawInput.customerPhone === "string"
      ? rawInput.customerPhone.trim()
      : "";

  if (customerName.length === 0 || customerName.length > 120) {
    fieldErrors.customerName = "Inserisci un nome valido.";
  }

  if (customerPhone.length === 0 || customerPhone.length > 40) {
    fieldErrors.customerPhone = "Inserisci un telefono valido.";
  }

  const customerEmail = normalizeOptionalString(rawInput.customerEmail, 254);

  if (
    customerEmail === undefined ||
    (customerEmail !== null && !emailPattern.test(customerEmail))
  ) {
    fieldErrors.customerEmail = "Inserisci un’email valida.";
  }

  let deliveryPoint: "A" | "B" | "C" | null = null;

  if (fulfillmentType === "delivery") {
    const point = rawInput.deliveryPoint;

    if (point !== "A" && point !== "B" && point !== "C") {
      fieldErrors.deliveryPoint = "Seleziona un punto di consegna.";
    } else {
      deliveryPoint = point;
    }
  }

  const requestedDate =
    typeof rawInput.requestedDate === "string"
      ? rawInput.requestedDate.trim()
      : "";

  if (
    !isRealDate(requestedDate) ||
    requestedDate < getTodayInRome()
  ) {
    fieldErrors.requestedDate = "Seleziona una data valida.";
  }

  const requestedTime = normalizeTime(rawInput.requestedTime);

  if (requestedTime === undefined) {
    fieldErrors.requestedTime = "Inserisci un orario valido.";
  }

  const customerNotes = normalizeOptionalString(rawInput.customerNotes, 1000);

  if (customerNotes === undefined) {
    fieldErrors.customerNotes = "Le note sono troppo lunghe.";
  }

  const turnstileToken =
    typeof rawInput.turnstileToken === "string"
      ? rawInput.turnstileToken.trim()
      : "";

  if (turnstileToken.length === 0 || turnstileToken.length > 2048) {
    fieldErrors.turnstileToken =
      "Completa la verifica di sicurezza prima di inviare l’ordine.";
  }

  const items: ValidatedCreateOrderInput["items"] = [];

  if (
    !Array.isArray(rawInput.items) ||
    rawInput.items.length === 0 ||
    rawInput.items.length > 50
  ) {
    fieldErrors.items = "Controlla i piatti e le quantità.";
  } else {
    const menuItemIds = new Set<string>();

    for (const rawItem of rawInput.items) {
      if (!isRecord(rawItem)) {
        fieldErrors.items = "Controlla i piatti e le quantità.";
        break;
      }

      const menuItemId =
        typeof rawItem.menuItemId === "string"
          ? rawItem.menuItemId.trim()
          : "";
      const quantity = rawItem.quantity;
      const itemNotes = normalizeOptionalString(rawItem.customerNotes, 500);

      if (
        !uuidPattern.test(menuItemId) ||
        typeof quantity !== "number" ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99 ||
        itemNotes === undefined ||
        menuItemIds.has(menuItemId.toLowerCase())
      ) {
        fieldErrors.items = "Controlla i piatti e le quantità.";
        break;
      }

      menuItemIds.add(menuItemId.toLowerCase());
      items.push({
        menuItemId,
        quantity,
        customerNotes: itemNotes,
      });
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    (fulfillmentType !== "delivery" && fulfillmentType !== "pickup") ||
    customerEmail === undefined ||
    requestedTime === undefined ||
    customerNotes === undefined
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      idempotencyKey,
      fulfillmentType,
      customerName,
      customerPhone,
      customerEmail,
      deliveryPoint,
      requestedDate,
      requestedTime,
      customerNotes,
      turnstileToken,
      items,
    },
  };
}
