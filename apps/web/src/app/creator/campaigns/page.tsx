import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getCreatorContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function CreatorCampaignsPage() {
  const { creator } = await getCreatorContext();
  const memberships = await prisma.campaignCreator.findMany({
    where: { creatorId: creator.id },
    include: {
      campaign: { include: { workspace: true } },
      deliverables: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="My campaigns" description="Active and past collaborations" />
      {memberships.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Apply from Opportunities to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {memberships.map((m) => (
            <Link key={m.id} href={`/creator/campaigns/${m.campaignId}`}>
              <Card className="h-full hover:border-violet-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-violet-600">{m.campaign.workspace.name}</p>
                    <h2 className="font-semibold text-slate-900">{m.campaign.title}</h2>
                  </div>
                  <Badge status={m.status} />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {formatMoney(m.offeredFeeCents)} ·{" "}
                  {m.deliverables.filter((d) => ["LIVE", "APPROVED", "SUBMITTED"].includes(d.status)).length}
                  /{m.deliverables.length} deliverables moving
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
