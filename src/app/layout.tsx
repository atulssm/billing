import type { Metadata } from "next";
import "@/app/globals.css";
import { MobileNav } from "@/app/_components/mobile-nav";
import { AppHeader } from "@/app/_components/app-header";

export const metadata: Metadata = {
  title: "Billing MVP",
  description: "Simple billing and reporting MVP aligned with Supabase schema.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col pb-14 sm:pb-0">
          <AppHeader />
          <main className="flex-1">
            <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6 lg:py-8">
              {children}
            </div>
          </main>
          <footer className="hidden border-t border-slate-900 bg-slate-950/80 sm:block">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-xs text-slate-500">
              <span>Billing MVP · Supabase + Next.js</span>
              <span>Reports: net cash · sales booked</span>
            </div>
          </footer>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}

