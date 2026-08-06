import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <section className="relative min-h-[100dvh] overflow-hidden">
        <div className="hero-atmosphere" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(240,162,2,0.18),transparent_35%)]" />

        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-6 pb-16 pt-8">
          <nav className="flex items-center justify-between animate-rise">
            <BrandMark size="md" href={null} />
            <Link
              href="/learn"
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              Open app
            </Link>
          </nav>

          <div className="my-auto max-w-3xl py-16">
            <BrandMark size="hero" href={null} />
            <h1 className="mt-6 max-w-2xl font-display text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl animate-rise">
              Speak your way home.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl animate-rise">
              Bite-sized lessons in African and Caribbean dialects — for diaspora
              hearts reconnecting with the languages of home.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-rise">
              <Link href="/dialects" className="btn-primary bg-[var(--mango)] shadow-[0_4px_0_rgba(140,90,0,0.45)] hover:bg-[#e09600]">
                Choose a dialect
              </Link>
              <Link
                href="/learn"
                className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Continue learning
              </Link>
            </div>
          </div>

          <p className="animate-drift text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
            Kreyòl · Patwa · Naija · Trini · Gh Pidgin · Kriolu
          </p>
        </div>
      </section>

      <section className="wave-pattern border-t border-[var(--ink)]/8 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
            Learn like play. Remember like family.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-[var(--ink)]/70">
            Short drills, streaks, and culture notes — modeled on the rhythm of
            apps you already know, tuned for Creole and Pidgin voices.
          </p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                title: "Daily path",
                body: "Unlock lessons one by one with XP, hearts, and a streak that keeps you coming back.",
              },
              {
                title: "Real phrases",
                body: "Market talk, greetings, and kitchen words — the language people actually use at home.",
              },
              {
                title: "Diaspora-first",
                body: "Built for learners abroad reclaiming heritage tongues across Africa and the Caribbean.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="animate-rise"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <p className="font-display text-xl font-bold text-[var(--lagoon)]">
                  {item.title}
                </p>
                <p className="mt-2 text-[var(--ink)]/70">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14">
            <Link href="/dialects" className="btn-primary">
              Start with your roots
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--ink)]/8 px-6 py-8 text-sm text-[var(--ink)]/55">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <BrandMark size="sm" />
          <p>Made for the African & Caribbean diaspora.</p>
        </div>
      </footer>
    </div>
  );
}
