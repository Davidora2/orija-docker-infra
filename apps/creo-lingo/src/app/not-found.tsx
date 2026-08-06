import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <BrandMark size="lg" />
      <h1 className="mt-6 font-display text-3xl font-bold text-[var(--ink)]">
        Page no dey
      </h1>
      <p className="mt-2 text-[var(--ink)]/70">
        That path doesn&apos;t exist. Head back to your lessons.
      </p>
      <Link href="/learn" className="btn-primary mt-8">
        Back to learn
      </Link>
    </div>
  );
}
