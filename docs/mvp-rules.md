# MVP rules (canonical)

This document codifies the MVP business rules so the UI, API, and database stay consistent.

## Status enums (MVP)

- **Payment status** (`payment_status`):
  - `unpaid`, `partial`, `paid`, `refunded`
- **Payment method** (`payment_method`):
  - `cash`, `upi`, `card`, `other`
- **Delivery status** (`delivery_status`):
  - `created`, `out_for_delivery`, `delivered`, `cancelled`, `returned`
- **Payment kind** (`payment_kind`):
  - `payment` (money in), `refund` (money out)

Source of truth:
- Database: `supabase/migrations/0001_mvp_schema.sql`
- App types: `src/lib/domain.ts`

## Reports definition (MVP)

### Earnings (recommended)

**Earnings = cash received (net), by payment date**.

In other words:

\[
\text{net\_cash}=\sum(\text{payments})-\sum(\text{refunds})
\]

- Grouping key: `payments.paid_at` (day/week/month)
- Filters: date range, `method`
- Data source: `public.v_cash_received_daily`

### Optional (not earnings): Sales booked

**Sales booked = sum of order totals, by order creation date**.

- Grouping key: `orders.created_at`
- Data source: `public.v_order_total_daily`

## Required fields (MVP)

### Customer

- **Required**: `tenant_id`, `name`, `phone`
- **Optional**: `address`
- **Constraint**: unique `(tenant_id, phone)` for fast lookup

### Product

- **Required**: `tenant_id`, `name`, `price`, `active`
- **Optional**: `sku`, `description`
- **Constraint**: unique `(tenant_id, sku)` when `sku` is present

### Order

- **Required**:
  - Identity: `tenant_id`, `customer_id`
  - Statuses: `payment_status`, `delivery_status`
  - Money: `subtotal`, `discount`, `tax`, `total`, `currency_code`
- **Optional**: `notes`, `delivered_at`

### Inventory (basic)

- **Required**: `tenant_id`, `name`, `quantity`
- **Optional**: `buying_date`, `buying_price`, `vendor_id`
- **Vendor provision**: `vendors` table exists; inventory items can reference a vendor you bought from.

