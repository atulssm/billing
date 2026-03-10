
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";

type InventoryItemRow = {
  id: string;
  name: string;
  quantity: number;
  buyingPrice: number | null;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, quantity, buying_price")
        .eq("tenant_id", TENANT_ID)
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load inventory items", error);
        setError("Could not load inventory from database.");
      } else {
        setItems(
          (data ?? []).map((row: any) => ({
            id: row.id as string,
            name: row.name as string,
            quantity: Number(row.quantity ?? 0),
            buyingPrice:
              row.buying_price === null || row.buying_price === undefined
                ? null
                : Number(row.buying_price),
          }))
        );
      }
      setLoading(false);
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <button
        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.99] sm:w-auto disabled:opacity-60"
        disabled
      >
        Add item (coming soon)
      </button>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Inventory
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading inventory...</p>
        ) : error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400">
            No inventory items yet. You can wire this screen to your purchase
            flow later.
          </p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-[11px] text-slate-400">
                    Qty: {item.quantity.toFixed(2)}
                    {item.buyingPrice != null
                      ? ` · Buying ₹ ${item.buyingPrice.toFixed(0)}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

