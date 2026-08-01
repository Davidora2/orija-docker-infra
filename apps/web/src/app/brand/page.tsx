import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber } from "@/lib/format";

export default async function BrandDashboard() {
  const { workspace } = await getBrandContext();

  const [campaigns, memberships, applications, deliverables, assets] =
    await Promise.all([
      prisma.campaign.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.campaignCreator.findMany({
        where: { campaign: { workspaceId: workspace.id } },
        include: {
          creator: { include: { user: true } },
          campaign: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.application.count({
        where: {
          status: "pending",
          campaign: { workspaceId: workspace.id },
        },
      }),
      prisma.deliverable.findMany({
        where: { campaignCreator: { campaign: { workspaceId: workspace.id } } },
      }),
      prisma.affiliateAsset.findMany({
        where: {
          campaignCreator: { campaign: { workspaceId: workspace.id } },
        },
      }),
    ]);

  const livePosts = deliverables.filter((d) => d.status === "LIVE").length;
  const totalViews = deliverables.reduce((s, d) => s + d.views, 0);
  const revenue = assets.reduce((s, a) => s + a.revenueCents, 0);
  const spendPotential = memberships
    .filter((m) => ["ACTIVE", "PAID", "COMPLETED", "DELIVERABLES_SUBMITTED"].includes(m.status))
    .reduce((s, m) => s + (m.offeredFeeCents || 0), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Workspace · ${workspace.name}`}
        actions={
          <Link
            href="/brand/campaigns/new"
            className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            New campaign
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active campaigns" value={String(campaigns.filter((c) => c.status === "ACTIVE").length)} />
        <Stat label="Pending applications" value={String(applications)} hint="Needs review" />
        <Stat label="Live posts" value={String(livePosts)} hint={`${formatNumber(totalViews)} views tracked`} />
        <Stat label="Affiliate revenue" value={formatMoney(revenue)} hint={`Fees committed ${formatMoney(spendPotential)}`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Campaigns</h2>
            <Link href="/brand/campaigns" className="text-sm text-violet-600">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/brand/campaigns/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.compModel} · {c.objective}</p>
                </div>
                <Badge status={c.status} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Creator pipeline</h2>
            <Link href="/brand/discovery" className="text-sm text-violet-600">
              Discover
            </Link>
          </div>
          <div className="space-y-3">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {m.creator.user.name}{" "}
                    <span className="text-slate-400">@{m.creator.handle}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.campaign.title}</p>
                </div>
                <Badge status={m.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
