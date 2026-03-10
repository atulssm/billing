export const TENANT_ID = process.env.NEXT_PUBLIC_SUPABASE_TENANT_ID;

if (!TENANT_ID) {
  throw new Error(
    "Missing tenant id. Set NEXT_PUBLIC_SUPABASE_TENANT_ID in .env.local to the id of a row in public.tenants."
  );
}

