export const PAYMENT_STATUS = ["unpaid", "partial", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHOD = ["cash", "upi", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

export const DELIVERY_STATUS = [
  "created",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const PAYMENT_KIND = ["payment", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KIND)[number];

export type CustomerRequiredFields = "tenant_id" | "name" | "phone";
export type CustomerOptionalFields = "address";

export type ProductRequiredFields = "tenant_id" | "name" | "price" | "active";
export type ProductOptionalFields = "sku" | "description";

export type OrderRequiredFields =
  | "tenant_id"
  | "customer_id"
  | "payment_status"
  | "delivery_status"
  | "subtotal"
  | "discount"
  | "tax"
  | "total"
  | "currency_code";

