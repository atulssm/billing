"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavIconName = "home" | "grid" | "user" | "receipt";

const NAV_ITEMS: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/menu", label: "Menu", icon: "grid" },
  { href: "/customers", label: "Customer", icon: "user" },
  { href: "/orders", label: "Order", icon: "receipt" },
];

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <span className="mb-0.5 flex h-4 w-4 items-center justify-center text-slate-200">
      {name === "home" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1v-8.5Z"
            className="fill-none stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {name === "grid" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1.2" className="fill-none stroke-current" strokeWidth="1.6" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" className="fill-none stroke-current" strokeWidth="1.6" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" className="fill-none stroke-current" strokeWidth="1.6" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" className="fill-none stroke-current" strokeWidth="1.6" />
        </svg>
      )}
      {name === "user" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
            className="fill-none stroke-current"
            strokeWidth="1.6"
          />
          <path
            d="M6 18.4C6.9 16.4 9.2 15 12 15s5.1 1.4 6 3.4"
            className="fill-none stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      {name === "receipt" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M7 4h10a1 1 0 0 1 1 1v13l-2-1-2 1-2-1-2 1-2-1-2 1V5a1 1 0 0 1 1-1Z"
            className="fill-none stroke-current"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 8.5h6M9 11.5h4"
            className="fill-none stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-1 py-1 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-1 flex-col items-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                active
                  ? "bg-emerald-500/10 text-emerald-200"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
              ].join(" ")}
            >
              <NavIcon name={item.icon} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

