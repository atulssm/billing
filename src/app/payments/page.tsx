"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";
import type { PaymentKind, PaymentMethod } from "@/lib/domain";

type PaymentRow = {
  id: string;
  amount: number;
  method: PaymentMethod;
  kind: PaymentKind;
  paidAt: string;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, kind, paid_at")
        .eq("tenant_id", TENANT_ID)
        .order("paid_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load payments", error);
        setError("Could not load payments from database.");
      } else {
        setPayments(
          (data ?? []).map((row: any) => ({
            id: row.id as string,
            amount: Number(row.amount ?? 0),
            method: row.method as PaymentMethod,
            kind: row.kind as PaymentKind,
            paidAt: row.paid_at as string,
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

  const netToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return payments.reduce((sum, p) => {
      const day = p.paidAt.slice(0, 10);
      if (day !== todayStr) return sum;
      const sign = p.kind === "refund" ? -1 : 1;
      return sum + sign * p.amount;
    }, 0);
  }, [payments]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.99] disabled:opacity-60"
          disabled
        >
          Add payment (coming soon)
        </button>
        <button
          className="hidden items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 active:scale-[0.99] disabled:opacity-60 sm:inline-flex"
          disabled
        >
          Add refund
        </button>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <p className="text-xs text-slate-400">
          Today&apos;s net cash received (payments minus refunds):
        </p>
        <p className="text-lg font-semibold text-emerald-300">
          ₹ {netToday.toFixed(0)}
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Recent movements
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading payments...</p>
        ) : error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-slate-400">
            No payments have been recorded yet.
          </p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-100">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {p.kind === "refund" ? "Refund" : "Payment"} · {p.method}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(p.paidAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    "ml-2 text-sm font-semibold " +
                    (p.kind === "refund" ? "text-rose-300" : "text-emerald-300")
                  }
                >
                  {p.kind === "refund" ? "-" : "+"}₹ {p.amount.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

