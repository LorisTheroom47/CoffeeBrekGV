export type AdminOrderSummary = {
  id: string;
  orderNumber: string | null;
  fulfillmentType: string;
  status: string;
  customerName: string;
  requestedDate: string;
  requestedTime: string | null;
  total: string | number | null;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string | null;
  fulfillmentType: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryPostalCode: string | null;
  requestedDate: string;
  requestedTime: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  subtotal: string | number | null;
  deliveryFee: string | number | null;
  total: string | number | null;
  createdAt: string;
};

export type AdminOrderItemDetail = {
  id: string;
  itemName: string;
  unitPrice: string | number | null;
  quantity: number;
  lineTotal: string | number | null;
  customerNotes: string | null;
};

export type AdminOrderStatusPresentation = {
  label: string;
  className: string;
};

export type AdminOrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type AdminOrderTargetStatus = Exclude<AdminOrderStatus, "new">;

const adminOrderStatuses: readonly AdminOrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

const adminOrderTargetStatuses: readonly AdminOrderTargetStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export function isAdminOrderStatus(value: string): value is AdminOrderStatus {
  return adminOrderStatuses.some((status) => status === value);
}

export function isAdminOrderTargetStatus(
  value: string,
): value is AdminOrderTargetStatus {
  return adminOrderTargetStatuses.some((status) => status === value);
}

export function getAllowedAdminOrderTransitions(
  currentStatus: AdminOrderStatus,
  fulfillmentType: string,
): readonly AdminOrderTargetStatus[] {
  switch (currentStatus) {
    case "new":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["preparing", "cancelled"];
    case "preparing":
      return ["ready", "cancelled"];
    case "ready":
      if (fulfillmentType === "pickup") return ["completed", "cancelled"];
      if (fulfillmentType === "delivery") {
        return ["out_for_delivery", "cancelled"];
      }
      return [];
    case "out_for_delivery":
      return fulfillmentType === "delivery"
        ? ["completed", "cancelled"]
        : [];
    case "completed":
    case "cancelled":
      return [];
  }
}

const statusPresentations: Readonly<
  Record<string, AdminOrderStatusPresentation>
> = {
  new: { label: "Nuovo", className: "admin-status-order-new" },
  confirmed: {
    label: "Confermato",
    className: "admin-status-order-confirmed",
  },
  preparing: {
    label: "In preparazione",
    className: "admin-status-order-preparing",
  },
  ready: { label: "Pronto", className: "admin-status-order-ready" },
  out_for_delivery: {
    label: "In consegna",
    className: "admin-status-order-delivery",
  },
  completed: {
    label: "Completato",
    className: "admin-status-order-completed",
  },
  cancelled: {
    label: "Annullato",
    className: "admin-status-order-cancelled",
  },
};

const unavailableStatus: AdminOrderStatusPresentation = {
  label: "Stato non disponibile",
  className: "admin-status-unknown",
};

export function getAdminOrderStatusPresentation(
  status: string,
): AdminOrderStatusPresentation {
  return statusPresentations[status] ?? unavailableStatus;
}

export function getAdminOrderFulfillmentLabel(value: string): string {
  if (value === "delivery") return "Consegna";
  if (value === "pickup") return "Ritiro";
  return "Modalità non disponibile";
}

export function isValidAdminOrderId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function formatAdminOrderNumber(value: string | null): string {
  return value && /^[1-9]\d*$/.test(value) ? `#${value}` : "Non disponibile";
}

export function formatAdminOrderCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Data non disponibile";

  const parts = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("day")}/${values.get("month")}/${values.get("year")} ${values.get("hour")}:${values.get("minute")}`;
}

export function formatAdminRequestedDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data non disponibile";
}

export function formatAdminRequestedTime(value: string | null): string | null {
  if (value === null) return null;

  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : "Orario non disponibile";
}

export function formatAdminOrderTotal(
  value: string | number | null,
): string {
  if (value === null) return "Totale non disponibile";

  const rawValue = typeof value === "number" ? String(value) : value;

  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(rawValue)) {
    return "Totale non disponibile";
  }

  const [euros, cents = ""] = rawValue.split(".");
  const groupedEuros = euros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${groupedEuros},${cents.padEnd(2, "0")} €`;
}
