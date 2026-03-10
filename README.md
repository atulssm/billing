# Billing MVP

Next.js + TypeScript starter for a small billing and reporting system, aligned with the canonical MVP rules in `docs/mvp-rules.md` and the Supabase schema in `supabase/migrations/0001_mvp_schema.sql`.

## Tech stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **UI**: Tailwind CSS 4 (CSS-first `@import "tailwindcss"` in `src/app/globals.css`)
- **DB**: Supabase / Postgres (schema defined in `supabase/migrations/0001_mvp_schema.sql`)

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

3. Open the app:

- Visit `http://localhost:3000` to see the Billing MVP dashboard shell.

4. Connect to local Supabase:

- Copy `.env.local.example` to `.env.local`.
- Run `npx supabase status` and copy the local project:
  - `API URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart `npm run dev` so Next.js picks up the new env vars.

## Domain alignment

- **Status enums**: `src/lib/domain.ts` mirrors the enums in the Supabase migration (`payment_status`, `payment_method`, `delivery_status`, `payment_kind`).
- **Reports**:
  - Earnings are based on **net cash received** (payments minus refunds) grouped by payment date (`public.v_cash_received_daily`).
  - Optional "sales booked" view uses order totals grouped by order creation date (`public.v_order_total_daily`).
- **Required/optional fields** for customers, products, orders, and inventory are documented in `docs/mvp-rules.md` and enforced in the DB schema.

As you build out features (customers, orders, payments, inventory), keep UI, API handlers, and DB tables in sync with `docs/mvp-rules.md` and `src/lib/domain.ts`.

