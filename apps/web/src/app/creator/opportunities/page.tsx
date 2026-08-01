import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";
import { applyToCampaign } from "@/app/actions";
import { getCreatorContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent } from "@/lib/format";
import { parseJsonArray } from "@/lib/utils";

export default async function OpportunitiesPage() {
  const { creator } = await getCreatorContext();

  const campaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE", applicationOpen: true },
    include: {
      workspace: true,
      requirements: true,
      applications: { where: { creatorId: creator.id } },
      memberships: { where: { creatorId: creator.id } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description="Preview briefs & terms, then apply"
      />

      {campaigns.length === 0 ? (
        <EmptyState title="No open campaigns" description="Check back soon." />
      ) : (
        <div className="space-y-5">
          {campaigns.map((c) => {
            const existing = c.applications[0];
            const membership = c.memberships[0];
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-violet-600">{c.workspace.name}</p>
                    <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{c.objective}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge status={c.compModel} />
                    {existing ? <Badge status={existing.status.toUpperCase()} /> : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  {parseJsonArray(c.platforms).map((p) => (
                    <span key={p} className="rounded-full bg-slate-100 px-2 py-1">
                      {p}
                    </span>
                  ))}
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    Fee {formatMoney(c.feeCents)}
                  </span>
                  {c.affiliateRate ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      Affiliate {formatPercent(c.affiliateRate)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Brief preview</h3>
                    <div className="prose-brief mt-2 max-h-40 overflow-hidden whitespace-pre-wrap">
                      {c.brief}
                    </div>
                    <Link
                      href={`/preview/${c.previewToken}`}
                      className="mt-2 inline-block text-sm text-violet-600"
                    >
                      Open full brief & terms →
                    </Link>
                  </div>

                  {existing || membership?.status === "ACTIVE" ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      {membership?.status === "ACTIVE" || existing?.status === "accepted" ? (
                        <p>
                          You&apos;re in!{" "}
                          <Link
                            className="text-violet-600"
                            href={`/creator/campaigns/${c.id}`}
                          >
                            View campaign tasks
                          </Link>
                        </p>
                      ) : (
                        <p>Application {existing?.status}. Brand is reviewing.</p>
                      )}
                    </div>
                  ) : (
                    <form action={applyToCampaign} className="space-y-3">
                      <input type="hidden" name="campaignId" value={c.id} />
                      <Textarea
                        name="pitch"
                        label="Your pitch"
                        rows={4}
                        required
                        placeholder="Why you're a fit + creative angle"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          name="proposedFee"
                          label="Proposed fee (USD)"
                          type="number"
                          defaultValue={c.feeCents ? String(c.feeCents / 100) : ""}
                        />
                        <Input
                          name="timeline"
                          label="Timeline"
                          placeholder="Draft in 5 days"
                        />
                      </div>
                      <Button type="submit">Apply</Button>
                    </form>
                  )}
                </div>

                <ul className="mt-4 text-xs text-slate-500">
                  {c.requirements.map((r) => (
                    <li key={r.id}>
                      {r.quantity}× {r.platform} {r.contentType}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
