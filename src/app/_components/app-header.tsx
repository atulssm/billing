"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function titleForPath(pathname: string | null): string {
  if (!pathname) return "Home";
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/menu")) return "Menu";
  if (pathname.startsWith("/customers")) return "Customer";
  if (pathname.startsWith("/orders")) return "Order";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
}

export function AppHeader() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-500/90" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">
              {title}
            </span>
            <span className="text-xs text-slate-400">Billing MVP</span>
          </div>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-200 hover:border-emerald-500/60 hover:text-emerald-100"
        >
          ⚙
        </Link>
      </div>
    </header>
  );
}

