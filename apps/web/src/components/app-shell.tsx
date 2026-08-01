"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Compass,
  LayoutDashboard,
  Mail,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const brandNav = [
  { href: "/brand", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand/discovery", label: "Discovery", icon: Compass },
  { href: "/brand/campaigns", label: "Campaigns", icon: Briefcase },
  { href: "/brand/lists", label: "Community", icon: Users },
  { href: "/brand/templates", label: "Outreach", icon: Mail },
  { href: "/brand/analytics", label: "Analytics", icon: BarChart3 },
];

const creatorNav = [
  { href: "/creator", label: "Home", icon: LayoutDashboard },
  { href: "/creator/opportunities", label: "Opportunities", icon: Sparkles },
  { href: "/creator/campaigns", label: "My campaigns", icon: Briefcase },
  { href: "/creator/earnings", label: "Earnings", icon: Wallet },
];

export function AppShell({
  persona,
  userName,
  workspaceName,
  children,
}: {
  persona: "brand" | "creator";
  userName: string;
  workspaceName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = persona === "brand" ? brandNav : creatorNav;

  async function switchPersona(next: "brand" | "creator") {
    await fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: next }),
    });
    router.push(next === "brand" ? "/brand" : "/creator");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f5f3ff_0%,_#f8fafc_45%,_#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur lg:flex">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
              CM
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">CreatoMatch</p>
              <p className="text-xs text-slate-500">
                {persona === "brand" ? workspaceName || "Brand" : "Creator portal"}
              </p>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/brand" &&
                  item.href !== "/creator" &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">Demo persona</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => switchPersona("brand")}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium",
                  persona === "brand"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200",
                )}
              >
                Brand
              </button>
              <button
                onClick={() => switchPersona("creator")}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium",
                  persona === "creator"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200",
                )}
              >
                Creator
              </button>
            </div>
            <p className="truncate text-xs text-slate-500">{userName}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">CreatoMatch</p>
              <div className="flex gap-2">
                <button
                  onClick={() => switchPersona("brand")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs"
                >
                  Brand
                </button>
                <button
                  onClick={() => switchPersona("creator")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs"
                >
                  Creator
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
