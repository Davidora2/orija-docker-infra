import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { parseJsonArray } from "@/lib/utils";

export default async function CampaignsPage() {
  const { workspace } = await getBrandContext();
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { memberships: true, applications: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Paid, gifting, affiliate, and hybrid programs"
        actions={
          <Link
            href="/brand/campaigns/new"
            className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white"
          >
            New campaign
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign with brief, terms, and compensation."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/brand/campaigns/${c.id}`}>
              <Card className="h-full transition hover:border-violet-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">{c.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {c.objective || "No objective set"}
                    </p>
                  </div>
                  <Badge status={c.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{c.compModel}</span>
                  {parseJsonArray(c.platforms).map((p) => (
                    <span key={p} className="rounded-full bg-slate-100 px-2 py-1">
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-4 text-sm text-slate-600">
                  <span>{c._count.memberships} creators</span>
                  <span>{c._count.applications} apps</span>
                  <span>{formatMoney(c.feeCents)} fee</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
