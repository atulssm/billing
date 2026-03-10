"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QuantityStepper } from "@/app/_components/quantity-stepper";
import { supabase } from "@/lib/supabaseClient";
import { TENANT_ID } from "@/lib/tenant";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
};

type SelectedItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

// Products will be loaded from Supabase for the active tenant.
const PRODUCTS: Product[] = [];

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get("mode");
  const [mode, setMode] = useState<"order" | "newCustomer">(
    initialModeParam === "newCustomer" ? "newCustomer" : "order"
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [showMenuSheet, setShowMenuSheet] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<
    "unpaid" | "partial" | "paid" | "refunded"
  >("unpaid");
  const [deliveryStatus, setDeliveryStatus] = useState<
    "created" | "out_for_delivery" | "delivered" | "cancelled" | "returned"
  >("created");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  const itemsSubtotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
      ),
    [selectedItems]
  );

  const discountNum = discount === "" ? 0 : Number(discount);
  const taxNum = tax === "" ? 0 : Number(tax);
  const computedTotal = Math.max(0, itemsSubtotal - discountNum + taxNum);

  function setProductQuantity(product: Product, qty: number) {
    if (!selectedCustomer) return;

    setSelectedItems((prev) => {
      if (qty <= 0) {
        return prev.filter((p) => p.id !== product.id);
      }

      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty } : p
        );
      }

      return [
        ...prev,
        { id: product.id, name: product.name, price: product.price, qty },
      ];
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      // Load customers
      const { data: customerRows, error: customerError } = await supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("tenant_id", TENANT_ID)
        .order("name", { ascending: true });

      if (isMounted) {
        if (customerError) {
          console.error("Failed to load customers for orders", customerError);
        } else {
          setCustomers(
            (customerRows ?? []).map((row) => ({
              id: row.id as string,
              name: row.name as string,
              phone: row.phone as string,
              address: (row.address as string | null) ?? null,
            }))
          );
        }
      }

      // Load products
      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("tenant_id", TENANT_ID)
        .eq("active", true)
        .order("name", { ascending: true });

      if (isMounted) {
        if (productError) {
          console.error("Failed to load products for orders", productError);
        } else {
          const mapped: Product[] =
            productRows?.map((row) => ({
              id: row.id as string,
              name: row.name as string,
              price: Number(row.price ?? 0),
            })) ?? [];
          // Rebuild selectedItems to keep any existing quantities in sync by id
          setSelectedItems((prev) =>
            prev
              .map((sel) => {
                const found = mapped.find((p) => p.id === sel.id);
                return found
                  ? { ...sel, name: found.name, price: found.price }
                  : sel;
              })
              .filter((sel) => mapped.some((p) => p.id === sel.id))
          );
          // Replace PRODUCTS clone in closure by using mapped array via state in render below
          (PRODUCTS as Product[]).splice(0, PRODUCTS.length, ...mapped);
        }
      }
    }

    void loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 5);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [customerQuery, customers]);

  function handleAmountChange(
    value: string,
    setter: (v: string) => void
  ): void {
    if (value === "" || /^[0-9]*\.?[0-9]{0,2}$/.test(value)) {
      setter(value);
    }
  }

  function handleAddProduct(product: Product) {
    if (!selectedCustomer) return;
    const current =
      selectedItems.find((p) => p.id === product.id)?.qty ?? 0;
    setProductQuantity(product, current + 1);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selectedCustomer) {
      setMessage("Select a customer first.");
      return;
    }

    if (itemsSubtotal <= 0 || computedTotal <= 0) {
      setMessage("Add at least one product and valid amounts.");
      return;
    }

    async function save() {
      setSaving(true);
      try {
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            tenant_id: TENANT_ID,
            customer_id: selectedCustomer.id,
            payment_status: paymentStatus,
            delivery_status: deliveryStatus,
            subtotal: itemsSubtotal,
            discount: discountNum,
            tax: taxNum,
            total: computedTotal,
            currency_code: "INR",
            notes: notes.trim() || null,
          })
          .select("id")
          .maybeSingle();

        if (orderError || !order) {
          console.error("Failed to save order", orderError);
          setMessage("Failed to save order.");
          setSaving(false);
          return;
        }

        const orderId = order.id as string;

        const itemsPayload = selectedItems.map((item) => ({
          order_id: orderId,
          product_id: item.id,
          product_name_snapshot: item.name,
          quantity: item.qty,
          unit_price_snapshot: item.price,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(itemsPayload);

        if (itemsError) {
          console.error("Failed to save order items", itemsError);
          setMessage("Order saved but items could not be stored.");
          setSaving(false);
          return;
        }

        setMessage("Order saved.");
        setSelectedItems([]);
        setDiscount("");
        setTax("");
        setNotes("");
      } finally {
        setSaving(false);
      }
    }

    void save();
  }

  function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      return;
    }

    async function save() {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          tenant_id: TENANT_ID,
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          address: newCustomerAddress.trim() || null,
        })
        .select("id, name, phone, address")
        .maybeSingle();

      if (error || !data) {
        console.error("Failed to create customer", error);
        return;
      }

      const created: Customer = {
        id: data.id as string,
        name: data.name as string,
        phone: data.phone as string,
        address: (data.address as string | null) ?? null,
      };
      setCustomers((prev) => [...prev, created]);
      setSelectedCustomer(created);
      setCustomerQuery(created.name);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerAddress("");
      setMode("order");
    }

    void save();
  }

  if (mode === "newCustomer") {
    return (
      <div className="space-y-4 pb-2">
        <form
          onSubmit={handleCreateCustomer}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
        >
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">
                Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">
                Phone <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="10-digit phone"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Address</label>
              <textarea
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("order")}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 active:scale-[0.99]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 active:scale-[0.99]"
            >
              Save &amp; use
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      {!selectedCustomer && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search by name or phone"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            {showSuggestions && filteredCustomers.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/95 text-xs text-slate-100 shadow-lg">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerQuery(c.name);
                      setShowSuggestions(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-900"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {c.phone}
                      {c.address ? ` · ${c.address}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Add customer"
            onClick={() => setMode("newCustomer")}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/40 active:scale-95"
          >
            +
          </button>
        </div>
      )}

      {selectedCustomer && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
        >
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Customer
            </h2>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/5 px-3 py-2 text-xs text-slate-100">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedCustomer.name}
                </p>
                <p className="text-[11px] text-slate-300">
                  {selectedCustomer.phone}
                  {selectedCustomer.address
                    ? ` · ${selectedCustomer.address}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Change customer"
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowSuggestions(false);
                  setCustomerQuery("");
                }}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-[11px] text-slate-200 active:scale-95"
              >
                ✎
              </button>
            </div>
          </section>

          {selectedItems.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Items in this order
              </h2>
              <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-100">
                {selectedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <QuantityStepper
                        value={item.qty}
                        onChange={(next) =>
                          setProductQuantity(
                            { id: item.id, name: item.name, price: item.price },
                            next
                          )
                        }
                        min={0}
                      />
                      <span className="w-16 text-right text-slate-400">
                        ₹ {(item.price * item.qty).toFixed(0)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-1 space-y-1 border-t border-slate-800 pt-2 text-[11px] text-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Subtotal</span>
                  <span>₹ {itemsSubtotal.toFixed(0)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span>- ₹ {discountNum.toFixed(0)}</span>
                  </div>
                )}
                {taxNum > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>₹ {taxNum.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[12px] font-semibold">
                  <span className="text-slate-200">Total</span>
                  <span className="text-slate-50">
                    ₹ {computedTotal.toFixed(0)}
                  </span>
                </div>
              </div>
            </section>
          )}


          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">Payment status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as typeof paymentStatus)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Delivery status</label>
                <select
                  value={deliveryStatus}
                  onChange={(e) =>
                    setDeliveryStatus(e.target.value as typeof deliveryStatus)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none"
                >
                  <option value="created">Created</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Adjustments
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">Discount</label>
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) =>
                    handleAmountChange(e.target.value, setDiscount)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Tax</label>
                <input
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) =>
                    handleAmountChange(e.target.value, setTax)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Notes (optional)
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Delivery notes, landmarks, etc."
            />
          </section>

          {message && (
            <p className="text-[11px] text-emerald-300">{message}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowMenuSheet(true)}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 active:scale-[0.99]"
            >
              Add from menu
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
            >
              {saving ? "Saving..." : "Save order"}
            </button>
          </div>
        </form>
      )}

      {showMenuSheet && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40"
          onClick={() => setShowMenuSheet(false)}
        >
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[50vh] rounded-t-2xl border-t border-slate-800 bg-slate-950 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-700/80 mt-2" />
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-2 pb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Menu
              </h2>
              <button
                type="button"
                onClick={() => setShowMenuSheet(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200 active:scale-95"
              >
                ✕
              </button>
            </div>
            <div className="mx-auto max-w-5xl px-4 pb-2">
              <p className="text-[11px] text-slate-500">
                Tap + or use the stepper to adjust quantities.
              </p>
            </div>
            <div className="mx-auto max-w-5xl px-4">
              <div className="grid grid-cols-2 gap-2 pb-2 text-xs">
                {PRODUCTS.map((product) => {
                  const currentQty =
                    selectedItems.find((p) => p.id === product.id)?.qty ?? 0;

                  return (
                    <div
                      key={product.id}
                      role="button"
                      onClick={() => handleAddProduct(product)}
                      className="flex cursor-pointer flex-col items-start rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-100 active:scale-[0.99]"
                    >
                      <span className="text-sm font-medium">
                        {product.name}
                      </span>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        ₹ {product.price.toFixed(0)}
                      </span>
                      <div className="mt-2">
                        <QuantityStepper
                          value={currentQty}
                          onChange={(next) =>
                            setProductQuantity(product, next)
                          }
                          min={0}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

