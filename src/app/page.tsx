"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";
import {
  DELIVERY_STATUS,
  PAYMENT_METHOD,
} from "@/lib/domain";
import type {
  DeliveryStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentKind,
} from "@/lib/domain";

type OrderCard = {
  id: string;
  customerName: string;
  createdAt: string; // ISO string
  status: DeliveryStatus;
  paymentStatus: PaymentStatus;
  total: number;
  currency: string;
};

type OrderItemRow = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export default function HomePage() {
  const today = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ordersForDay, setOrdersForDay] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(false);

  const [orderItems, setOrderItems] = useState<Record<string, OrderItemRow[]>>(
    {}
  );
  const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});

  const [statusSheetOrderId, setStatusSheetOrderId] = useState<string | null>(
    null
  );
  const [pendingStatus, setPendingStatus] = useState<DeliveryStatus>("created");

  const [paymentSheetOrderId, setPaymentSheetOrderId] = useState<string | null>(
    null
  );
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [sheetSaving, setSheetSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);

      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, currency_code, payment_status, delivery_status, created_at, customers(name)"
        )
        .eq("tenant_id", TENANT_ID)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load orders for home", error);
        setOrdersForDay([]);
      } else {
        setOrdersForDay(
          (data ?? []).map((row: any) => ({
            id: row.id as string,
            customerName:
              (row.customers?.name as string | undefined) ?? "Unknown customer",
            createdAt: row.created_at as string,
            status: row.delivery_status as DeliveryStatus,
            paymentStatus: row.payment_status as PaymentStatus,
            total: Number(row.total ?? 0),
            currency: (row.currency_code as string | undefined) ?? "INR",
          }))
        );
      }

      setLoading(false);
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  function changeDateBy(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
    setExpandedId(null);
  }

  async function ensureItemsLoaded(orderId: string) {
    if (orderItems[orderId] || itemsLoading[orderId]) return;
    setItemsLoading((prev) => ({ ...prev, [orderId]: true }));

    const { data, error } = await supabase
      .from("order_items")
      .select("id, product_name_snapshot, quantity, unit_price_snapshot")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load order items", error);
      setItemsLoading((prev) => ({ ...prev, [orderId]: false }));
      return;
    }

    setOrderItems((prev) => ({
      ...prev,
      [orderId]:
        data?.map((row: any) => ({
          id: row.id as string,
          name: row.product_name_snapshot as string,
          qty: Number(row.quantity ?? 0),
          unitPrice: Number(row.unit_price_snapshot ?? 0),
        })) ?? [],
    }));
    setItemsLoading((prev) => ({ ...prev, [orderId]: false }));
  }

  async function updateDeliveryStatus(orderId: string, next: DeliveryStatus) {
    setSheetSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({ delivery_status: next })
      .eq("id", orderId)
      .eq("tenant_id", TENANT_ID);

    if (error) {
      console.error("Failed to update delivery status", error);
      setSheetSaving(false);
      return;
    }

    setOrdersForDay((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
    );
    setStatusSheetOrderId(null);
    setSheetSaving(false);
  }

  async function savePayment(orderId: string) {
    const order = ordersForDay.find((o) => o.id === orderId);
    if (!order) return;

    if (!paymentAmount || Number.isNaN(Number(paymentAmount))) {
      return;
    }
    const amountNum = Number(paymentAmount);
    if (amountNum <= 0) return;

    setSheetSaving(true);

    // Insert payment row
    const { error: paymentError } = await supabase.from("payments").insert({
      tenant_id: TENANT_ID,
      order_id: orderId,
      kind: "payment" as PaymentKind,
      method: paymentMethod,
      amount: amountNum,
    });

    if (paymentError) {
      console.error("Failed to record payment", paymentError);
      setSheetSaving(false);
      return;
    }

    // Recompute net paid to derive payment_status
    const { data: rows, error: aggError } = await supabase
      .from("payments")
      .select("amount, kind")
      .eq("tenant_id", TENANT_ID)
      .eq("order_id", orderId);

    if (aggError) {
      console.error("Failed to recompute payment status", aggError);
      setSheetSaving(false);
      return;
    }

    const netPaid =
      rows?.reduce((sum: number, row: any) => {
        const amt = Number(row.amount ?? 0);
        return sum + (row.kind === "refund" ? -amt : amt);
      }, 0) ?? 0;

    let nextStatus: PaymentStatus = "unpaid";
    if (netPaid <= 0) {
      nextStatus = "unpaid";
    } else if (netPaid < order.total) {
      nextStatus = "partial";
    } else {
      nextStatus = "paid";
    }

    const { error: statusError } = await supabase
      .from("orders")
      .update({ payment_status: nextStatus })
      .eq("id", orderId)
      .eq("tenant_id", TENANT_ID);

    if (statusError) {
      console.error("Failed to update payment status", statusError);
      setSheetSaving(false);
      return;
    }

    setOrdersForDay((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, paymentStatus: nextStatus } : o
      )
    );
    setPaymentSheetOrderId(null);
    setSheetSaving(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
        <button
          type="button"
          onClick={() => changeDateBy(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 active:scale-95"
        >
          {"<"}
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none text-center"
        />
        <button
          type="button"
          onClick={() => changeDateBy(1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 active:scale-95"
        >
          {">"}
        </button>
      </header>

      <section className="space-y-3">
        {loading ? (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-400">
            Loading orders...
          </p>
        ) : ordersForDay.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-400">
            No orders for this date yet.
          </p>
        ) : (
          ordersForDay.map((order) => {
            const expanded = expandedId === order.id;
            return (
              <article
                key={order.id}
                className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-sm shadow-slate-950/40"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-slate-50">
                      {order.customerName}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {order.currency} {order.total.toFixed(0)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextExpanded = expanded ? null : order.id;
                      setExpandedId(nextExpanded);
                      if (!expanded) {
                        void ensureItemsLoaded(order.id);
                      }
                    }}
                    className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-200 active:scale-95"
                  >
                    {expanded ? "Hide details" : "View details"}
                  </button>
                </header>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="space-y-0.5">
                    <p className="text-slate-400">Order status</p>
                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-100">
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-slate-400">Payment status</p>
                    <span className="inline-flex items-center justify-end rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-100">
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-slate-200">
                    <p className="mb-1 font-medium text-slate-100">
                      Order details
                    </p>
                    {itemsLoading[order.id] && !orderItems[order.id] ? (
                      <p className="text-xs text-slate-400">Loading items...</p>
                    ) : !orderItems[order.id] ||
                      orderItems[order.id].length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No items recorded for this order.
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {orderItems[order.id].map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between text-slate-300"
                          >
                            <span className="truncate">
                              {item.qty} × {item.name}
                            </span>
                            <span className="ml-2 text-slate-400">
                              {order.currency}{" "}
                              {(item.unitPrice * item.qty).toFixed(0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingStatus(order.status);
                          setStatusSheetOrderId(order.id);
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] font-medium text-slate-100 active:scale-95"
                      >
                        Change delivery status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(order.total.toFixed(0));
                          setPaymentMethod("cash");
                          setPaymentSheetOrderId(order.id);
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-2 py-1.5 text-[11px] font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-95"
                      >
                        Take payment
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {statusSheetOrderId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40"
          onClick={() => !sheetSaving && setStatusSheetOrderId(null)}
        >
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[50vh] rounded-t-2xl border-t border-slate-800 bg-slate-950 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-700/80" />
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-2 pb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Update delivery status
              </h2>
              <button
                type="button"
                onClick={() => !sheetSaving && setStatusSheetOrderId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200 active:scale-95"
              >
                ✕
              </button>
            </div>
            <div className="mx-auto max-w-5xl px-4 pb-2">
              <div className="space-y-1 text-xs text-slate-100">
                {DELIVERY_STATUS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      !sheetSaving &&
                      updateDeliveryStatus(statusSheetOrderId, value)
                    }
                    className={[
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left",
                      value === pendingStatus
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-700 bg-slate-900 text-slate-100",
                    ].join(" ")}
                  >
                    <span className="capitalize">
                      {value.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentSheetOrderId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40"
          onClick={() => !sheetSaving && setPaymentSheetOrderId(null)}
        >
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[55vh] rounded-t-2xl border-t border-slate-800 bg-slate-950 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-700/80" />
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-2 pb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Take payment
              </h2>
              <button
                type="button"
                onClick={() => !sheetSaving && setPaymentSheetOrderId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200 active:scale-95"
              >
                ✕
              </button>
            </div>
            <div className="mx-auto max-w-5xl space-y-3 px-4 pt-1 text-xs text-slate-100">
              <div className="space-y-1">
                <label className="text-slate-300">Amount (INR)</label>
                <input
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none"
                >
                  {PAYMENT_METHOD.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={sheetSaving}
                onClick={() =>
                  paymentSheetOrderId && savePayment(paymentSheetOrderId)
                }
                className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
              >
                {sheetSaving ? "Saving..." : "Save payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
