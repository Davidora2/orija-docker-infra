"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { useProgress } from "./progress-provider";

const links = [
  { href: "/learn", label: "Learn" },
  { href: "/dialects", label: "Dialects" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();
  const { progress, ready } = useProgress();
  const hide =
    pathname === "/" || pathname.startsWith("/lesson/");

  if (hide) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ink)]/8 bg-[var(--foam)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandMark size="sm" href="/learn" />
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--lagoon)] text-white"
                    : "text-[var(--ink)]/70 hover:bg-[var(--ink)]/5 hover:text-[var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 text-sm font-semibold sm:flex">
          <span className="text-[var(--flame)]" title="Streak">
            🔥 {ready ? progress.streak : "—"}
          </span>
          <span className="text-[var(--mango)]" title="XP">
            ⚡ {ready ? progress.totalXp : "—"}
          </span>
          <span className="text-[var(--hibiscus)]" title="Hearts">
            ❤ {ready ? progress.hearts : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
