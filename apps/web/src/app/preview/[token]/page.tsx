import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { markPreviewed } from "@/app/actions";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent } from "@/lib/format";
import { parseJsonArray } from "@/lib/utils";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { previewToken: token },
    include: {
      workspace: true,
      requirements: true,
    },
  });
  if (!campaign) notFound();

  await markPreviewed(campaign.id, token);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f5f3ff_0%,_#f8fafc_50%,_#ffffff_100%)]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            CreatoMatch
          </Link>
          <Badge status={campaign.status} />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-violet-600 px-6 py-8 text-white">
            <p className="text-sm text-violet-100">{campaign.workspace.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {campaign.title}
            </h1>
            <p className="mt-2 text-violet-100">{campaign.objective}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1">
                {campaign.compModel}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">
                Fee {formatMoney(campaign.feeCents)}
              </span>
              {campaign.affiliateRate ? (
                <span className="rounded-full bg-white/15 px-2.5 py-1">
                  Affiliate {formatPercent(campaign.affiliateRate)}
                </span>
              ) : null}
              {parseJsonArray(campaign.platforms).map((p) => (
                <span key={p} className="rounded-full bg-white/15 px-2.5 py-1">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-8 px-6 py-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Brief</h2>
              <div className="prose-brief mt-3 whitespace-pre-wrap">{campaign.brief}</div>
            </section>

            {campaign.dosAndDonts ? (
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Do&apos;s & don&apos;ts</h2>
                <div className="prose-brief mt-3 whitespace-pre-wrap">
                  {campaign.dosAndDonts}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Terms & usage rights</h2>
              <div className="prose-brief mt-3 whitespace-pre-wrap">{campaign.terms}</div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Deliverables</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {campaign.requirements.map((r) => (
                  <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
                    {r.quantity}× {r.platform} {r.contentType}
                    {r.description ? ` — ${r.description}` : ""}
                  </li>
                ))}
              </ul>
            </section>

            {campaign.giftDescription ? (
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Product gift</h2>
                <p className="mt-2 text-sm text-slate-600">{campaign.giftDescription}</p>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
              <Link
                href="/creator/opportunities"
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                Apply in creator portal
              </Link>
              <Link
                href="/brand"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800"
              >
                Brand workspace
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
