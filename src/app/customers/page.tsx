"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
};

export default function CustomersPage() {
  const [query, setQuery] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("tenant_id", TENANT_ID)
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load customers", error);
        setError("Could not load customers from database.");
      } else {
        setCustomers(
          (data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            phone: row.phone as string,
            address: (row.address as string | null) ?? null,
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
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [query, customers]);

  const grouped = useMemo(() => {
    const map = new Map<string, Customer[]>();

    for (const c of filtered) {
      const firstChar = c.name.trim().charAt(0);
      const key =
        firstChar && /[a-z]/i.test(firstChar) ? firstChar.toUpperCase() : "#";

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, customers]) => ({
        letter,
        customers: customers.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        ),
      }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5">
          <span className="text-xs text-slate-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or area"
            className="h-6 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>

        <Link
          href="/orders?mode=newCustomer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-base font-semibold text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.98]"
          aria-label="Add customer"
        >
          ＋
        </Link>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            Loading customers...
          </p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-xs text-rose-300">{error}</p>
        ) : grouped.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            No customers match your search.
          </p>
        ) : (
          grouped.map(({ letter, customers }) => (
            <div key={letter} className="space-y-1">
              <div className="sticky top-0 z-10 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                {letter}
              </div>
              <ul className="space-y-1">
                {customers.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-slate-100 hover:bg-slate-800/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {c.phone}
                        {c.address ? <span className="text-slate-600"> • {c.address}</span> : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-200 active:scale-95"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
