import type { DeliveryPoint } from "./delivery";

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  customerNotes?: string;
};

export type OrderMenuItem = {
  id: string;
  name: string;
  price: number;
  allergens: string[];
};

export type OrderMenuCategory = {
  id: string;
  name: string;
  slug: string;
  items: OrderMenuItem[];
};

export type CreateOrderInput = {
  idempotencyKey: string;
  fulfillmentType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryPoint?: DeliveryPoint;
  requestedDate: string;
  requestedTime?: string;
  customerNotes?: string;
  website?: string;
  turnstileToken: string;
  items: OrderItemInput[];
};

export type CreateOrderErrorCode =
  | "INVALID_CUSTOMER_DATA"
  | "INVALID_FULFILLMENT"
  | "INVALID_ITEMS"
  | "ITEM_NOT_AVAILABLE"
  | "INVALID_REQUEST_DATE"
  | "INVALID_REQUEST_TIME"
  | "REQUEST_TOO_LARGE"
  | "TOO_MANY_REQUESTS"
  | "SECURITY_CHECK_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_REQUEST"
  | "ORDER_CREATION_FAILED";

export type CreateOrderField =
  | "idempotencyKey"
  | "fulfillmentType"
  | "customerName"
  | "customerPhone"
  | "customerEmail"
  | "deliveryPoint"
  | "requestedDate"
  | "requestedTime"
  | "customerNotes"
  | "turnstileToken"
  | "items";

export type CreateOrderFieldErrors = Partial<
  Record<CreateOrderField, string>
>;

export type CreateOrderResult =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      total: string;
    }
  | {
      success: false;
      code: CreateOrderErrorCode;
      message: string;
      fieldErrors?: CreateOrderFieldErrors;
    };

export type ValidatedCreateOrderInput = {
  idempotencyKey: string;
  fulfillmentType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryPoint: DeliveryPoint | null;
  requestedDate: string;
  requestedTime: string | null;
  customerNotes: string | null;
  turnstileToken: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    customerNotes: string | null;
  }>;
};
