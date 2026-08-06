import Link from "next/link";

export function BrandMark({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg" | "hero";
  href?: string | null;
}) {
  const sizes = {
    sm: "text-xl tracking-tight",
    md: "text-2xl tracking-tight",
    lg: "text-4xl tracking-tight",
    hero: "text-6xl sm:text-7xl md:text-8xl tracking-[-0.04em]",
  };

  const mark = (
    <span className={`font-display font-bold leading-none ${sizes[size]}`}>
      <span className="text-[var(--ink)]">creo</span>
      <span className="text-[var(--mango)]">-</span>
      <span className="text-[var(--lagoon)]">lingo</span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-block transition-opacity hover:opacity-80">
      {mark}
    </Link>
  );
}
