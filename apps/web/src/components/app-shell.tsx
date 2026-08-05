"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookMarked,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Library,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/study", label: "Study Path", icon: BookOpen },
  { href: "/app/quiz", label: "Practice", icon: Activity },
  { href: "/app/flashcards", label: "Flashcards", icon: Layers },
  { href: "/app/rhythms", label: "Rhythms", icon: Library },
  { href: "/app/reading", label: "Reading List", icon: BookMarked },
  { href: "/app/exam-info", label: "Exam Intel", icon: CalendarDays },
  { href: "/app/resources", label: "Resources", icon: ExternalLink },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[#f8f5ee]/px-4 py-6 md:flex">
          <Link href="/" className="px-2">
            <div className="font-display text-2xl tracking-tight text-navy">TraceReady</div>
            <p className="mt-1 text-xs text-navy/60">CSCT exam prep</p>
          </Link>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-navy text-white"
                      : "text-navy/75 hover:bg-mist hover:text-navy",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <a
            href="https://www.csct.ca/EXAM-CANDIDATE"
            target="_blank"
            rel="noreferrer"
            className="mt-4 rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-xs text-navy/70 transition hover:border-teal"
          >
            Official CSCT candidate page ↗
          </a>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--background)]/90 px-4 py-3 backdrop-blur md:hidden">
            <Link href="/app" className="font-display text-xl text-navy">
              TraceReady
            </Link>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 text-navy"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </header>
          {open && (
            <div className="border-b border-[var(--line)] bg-[#f8f5ee] px-4 py-3 md:hidden">
              <nav className="flex flex-col gap-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-navy hover:bg-mist"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
