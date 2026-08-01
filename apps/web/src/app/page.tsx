import Link from "next/link";
import { ArrowRight, BadgeCheck, Link2, Search, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f8fafc_40%,_#ffffff_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
            CM
          </div>
          <span className="font-semibold text-slate-900">CreatoMatch</span>
        </div>
        <div className="flex gap-2">
          <Link
            href="/brand"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Brand demo
          </Link>
          <Link
            href="/creator"
            className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Creator demo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> Upfluence-style UGC campaigns
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Find creators by the content they share — then run the full campaign loop.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Discover, outreach with templates, preview briefs & terms, accept
            applications, pay or affiliate, and track posts with metrics in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/brand"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open brand workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/creator/opportunities"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Browse as creator
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Search,
              title: "Content discovery",
              body: "Match creators by niches, captions, topics, and engagement — not vanity metrics alone.",
            },
            {
              icon: BadgeCheck,
              title: "Brief → apply",
              body: "Creators preview terms, apply with a pitch, and brands approve in a clear pipeline.",
            },
            {
              icon: Link2,
              title: "Paid + affiliate",
              body: "Flat fees, gifting, unique tracking links/codes, and commission ledgers.",
            },
            {
              icon: Sparkles,
              title: "Post tracking",
              body: "Deliverable checklists, URL submission, metric sync, and campaign ROI.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <f.icon className="h-5 w-5 text-violet-600" />
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
