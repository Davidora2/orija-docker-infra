import Link from "next/link";
import { Card, PageHeader, Stat } from "@/components/ui";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export default async function AnalyticsPage() {
  const { workspace } = await getBrandContext();

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      memberships: {
        include: {
          creator: { include: { user: true } },
          deliverables: true,
          affiliateAsset: true,
          payouts: true,
          commissions: true,
        },
      },
    },
  });

  const deliverables = campaigns.flatMap((c) =>
    c.memberships.flatMap((m) => m.deliverables),
  );
  const assets = campaigns.flatMap((c) =>
    c.memberships.map((m) => m.affiliateAsset).filter(Boolean),
  );
  const payouts = campaigns.flatMap((c) => c.memberships.flatMap((m) => m.payouts));
  const commissions = campaigns.flatMap((c) =>
    c.memberships.flatMap((m) => m.commissions),
  );

  const views = deliverables.reduce((s, d) => s + d.views, 0);
  const engagement =
    deliverables.reduce((s, d) => s + (d.likes + d.comments + d.shares + d.saves), 0);
  const revenue = assets.reduce((s, a) => s + (a?.revenueCents || 0), 0);
  const paid = payouts
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amountCents, 0);
  const commissionTotal = commissions.reduce((s, c) => s + c.amountCents, 0);
  const spend = paid + commissionTotal;
  const roas = spend > 0 ? revenue / spend : 0;

  const leaderboard = campaigns
    .flatMap((c) =>
      c.memberships.map((m) => ({
        name: m.creator.user.name,
        handle: m.creator.handle,
        campaign: c.title,
        views: m.deliverables.reduce((s, d) => s + d.views, 0),
        revenue: m.affiliateAsset?.revenueCents || 0,
        er:
          m.deliverables.find((d) => d.engagementRate)?.engagementRate ||
          m.creator.engagementRate,
      })),
    )
    .sort((a, b) => b.views - a.views);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Campaign performance, content metrics, and affiliate ROI"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tracked views" value={formatNumber(views)} />
        <Stat label="Engagements" value={formatNumber(engagement)} />
        <Stat label="Affiliate revenue" value={formatMoney(revenue)} />
        <Stat
          label="ROAS"
          value={roas ? `${roas.toFixed(2)}x` : "—"}
          hint={`Spend ${formatMoney(spend)}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">Campaign rollup</h2>
          <div className="mt-4 space-y-3">
            {campaigns.map((c) => {
              const cViews = c.memberships
                .flatMap((m) => m.deliverables)
                .reduce((s, d) => s + d.views, 0);
              const cRev = c.memberships.reduce(
                (s, m) => s + (m.affiliateAsset?.revenueCents || 0),
                0,
              );
              return (
                <Link
                  key={c.id}
                  href={`/brand/campaigns/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      {c.memberships.length} creators · {formatNumber(cViews)} views
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatMoney(cRev)}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">Creator leaderboard</h2>
          <div className="mt-4 space-y-3">
            {leaderboard.map((row) => (
              <div
                key={`${row.handle}-${row.campaign}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {row.name}{" "}
                    <span className="text-slate-400">@{row.handle}</span>
                  </p>
                  <p className="text-xs text-slate-500">{row.campaign}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{formatNumber(row.views)} views</p>
                  <p className="text-xs text-slate-500">
                    ER {formatPercent(row.er)} · {formatMoney(row.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
