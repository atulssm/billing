"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  sku?: string | null;
  description?: string | null;
  active: boolean;
};

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const editingItem = items.find((i) => i.id === editingId) ?? null;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, sku, description, active")
        .eq("tenant_id", TENANT_ID)
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load menu", error);
        setMessage("Could not load menu from database.");
      } else {
        setItems(
          (data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            price: Number(row.price ?? 0),
            sku: (row.sku as string | null) ?? null,
            description: (row.description as string | null) ?? null,
            active: Boolean(row.active),
          }))
        );
      }
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku ?? "").toLowerCase().includes(q)
    );
  }, [query, items]);

  function startNew() {
    setEditingId(null);
    setName("");
    setPrice("");
    setSku("");
    setDescription("");
    setActive(true);
    setMessage(null);
    setShowForm(true);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    setSku(item.sku ?? "");
    setDescription(item.description ?? "");
    setActive(item.active);
    setMessage(null);
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!name.trim()) {
      setMessage("Name is required.");
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      setMessage("Price must be a number.");
      return;
    }

    const priceNum = Number(price);
    if (priceNum < 0) {
      setMessage("Price cannot be negative.");
      return;
    }

    async function save() {
      setLoading(true);
      if (editingId) {
        const { data, error } = await supabase
          .from("products")
          .update({
            name: name.trim(),
            price: priceNum,
            sku: sku.trim() || null,
            description: description.trim() || null,
            active,
          })
          .eq("id", editingId)
          .eq("tenant_id", TENANT_ID)
          .select("id, name, price, sku, description, active")
          .maybeSingle();

        if (error || !data) {
          console.error("Failed to update menu item", error);
          setMessage("Failed to update menu item.");
        } else {
          setItems((prev) =>
            prev.map((i) =>
              i.id === editingId
                ? {
                    id: data.id as string,
                    name: data.name as string,
                    price: Number(data.price ?? 0),
                    sku: (data.sku as string | null) ?? null,
                    description: (data.description as string | null) ?? null,
                    active: Boolean(data.active),
                  }
                : i
            )
          );
          setMessage("Menu item updated.");
        }
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({
            tenant_id: TENANT_ID,
            name: name.trim(),
            price: priceNum,
            sku: sku.trim() || null,
            description: description.trim() || null,
            active,
          })
          .select("id, name, price, sku, description, active")
          .maybeSingle();

        if (error || !data) {
          console.error("Failed to create menu item", error);
          setMessage("Failed to create menu item.");
        } else {
          const created: MenuItem = {
            id: data.id as string,
            name: data.name as string,
            price: Number(data.price ?? 0),
            sku: (data.sku as string | null) ?? null,
            description: (data.description as string | null) ?? null,
            active: Boolean(data.active),
          };
          setItems((prev) => [created, ...prev]);
          setEditingId(created.id);
          setMessage("Menu item created.");
        }
      }
      setLoading(false);
    }

    void save();
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Search + Add row (matches customers design) */}
      <section>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5">
            <span className="text-xs text-slate-500">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu by name or SKU"
              className="h-6 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-base font-semibold text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.98] disabled:opacity-60"
            aria-label="Add new menu item"
            disabled={loading}
          >
            ＋
          </button>
        </div>
      </section>

      {/* Menu list: only visible when not adding/editing */}
      {!showForm && (
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
            {loading ? (
              <li className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-slate-400">
                Loading menu...
              </li>
            ) : filtered.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-slate-400">
                No items match this search.
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.id}>
                  <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ₹ {item.price.toFixed(0)}
                        {item.sku ? ` · ${item.sku}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          item.active
                            ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                            : "border border-slate-600 bg-slate-800 text-slate-300",
                        ].join(" ")}
                      >
                        {item.active ? "Active" : "Hidden"}
                      </span>
                      <button
                        type="button"
                        aria-label="Edit menu item"
                        onClick={() => startEdit(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-[11px] text-slate-200 active:scale-95"
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
        >
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {editingItem ? "Edit menu item" : "New menu item"}
            </h2>
            {editingItem && (
              <p className="text-[11px] text-slate-500">
                Editing: {editingItem.name}
              </p>
            )}
          </div>
        </header>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Product name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Price (INR) <span className="text-rose-400">*</span>
            </label>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300">SKU (optional)</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Unique code for this product"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Short description to remind you what this is"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950"
            />
            Active (show in order menu)
          </label>
        </div>

        {message && (
          <p className="text-[11px] text-emerald-300">{message}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 active:scale-[0.99]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.99]"
          >
            {editingItem ? "Save changes" : "Create menu item"}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}

