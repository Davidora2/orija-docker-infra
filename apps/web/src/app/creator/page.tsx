import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { getCreatorContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber } from "@/lib/format";

export default async function CreatorHome() {
  const { creator, user } = await getCreatorContext();

  const [memberships, applications, openCampaigns] = await Promise.all([
    prisma.campaignCreator.findMany({
      where: { creatorId: creator.id },
      include: {
        campaign: true,
        deliverables: true,
        payouts: true,
        affiliateAsset: true,
        commissions: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.application.count({ where: { creatorId: creator.id } }),
    prisma.campaign.count({
      where: { status: "ACTIVE", applicationOpen: true },
    }),
  ]);

  const pendingDeliverables = memberships
    .flatMap((m) => m.deliverables)
    .filter((d) => d.status === "PENDING" || d.status === "NEEDS_REVISION").length;
  const earned =
    memberships.flatMap((m) => m.payouts).reduce((s, p) => s + (p.status === "PAID" ? p.amountCents : 0), 0) +
    memberships.flatMap((m) => m.commissions).reduce((s, c) => s + c.amountCents, 0);

  return (
    <div>
      <PageHeader
        title={`Hey ${user.name.split(" ")[0]}`}
        description={`@${creator.handle} · Creator portal`}
        actions={
          <Link
            href="/creator/opportunities"
            className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white"
          >
            Browse opportunities
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active memberships" value={String(memberships.filter((m) => ["ACTIVE", "DELIVERABLES_SUBMITTED"].includes(m.status)).length)} />
        <Stat label="Open campaigns" value={String(openCampaigns)} />
        <Stat label="Tasks due" value={String(pendingDeliverables)} hint="posts to submit" />
        <Stat label="Earnings" value={formatMoney(earned)} />
      </div>

      <Card className="mt-8">
        <h2 className="font-semibold text-slate-900">Your campaigns</h2>
        <div className="mt-4 space-y-3">
          {memberships.map((m) => (
            <Link
              key={m.id}
              href={`/creator/campaigns/${m.campaignId}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{m.campaign.title}</p>
                <p className="text-xs text-slate-500">
                  {m.campaign.compModel} · {m.deliverables.filter((d) => d.status === "LIVE").length}/
                  {m.deliverables.length} live
                  {m.affiliateAsset
                    ? ` · ${formatNumber(m.affiliateAsset.clicks)} affiliate clicks`
                    : ""}
                </p>
              </div>
              <Badge status={m.status} />
            </Link>
          ))}
          {memberships.length === 0 ? (
            <p className="text-sm text-slate-500">No campaigns yet — apply from Opportunities.</p>
          ) : null}
        </div>
      </Card>

      <p className="mt-4 text-xs text-slate-400">{applications} applications submitted</p>
    </div>
  );
}
