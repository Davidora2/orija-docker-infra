import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Stat,
} from "@/components/ui";
import {
  createPayout,
  inviteCreator,
  markDeliverable,
  reviewApplication,
} from "@/app/actions";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { parseJsonArray } from "@/lib/utils";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await getBrandContext();

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      requirements: true,
      applications: {
        include: { creator: { include: { user: true, socialAccounts: true } } },
        orderBy: { createdAt: "desc" },
      },
      memberships: {
        include: {
          creator: { include: { user: true, socialAccounts: true } },
          affiliateAsset: true,
          deliverables: { orderBy: { createdAt: "asc" } },
          payouts: true,
          commissions: true,
          messages: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!campaign) notFound();

  const templates = await prisma.outreachTemplate.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });
  const allCreators = await prisma.creator.findMany({
    include: { user: true },
    orderBy: { handle: "asc" },
  });

  const totalViews = campaign.memberships
    .flatMap((m) => m.deliverables)
    .reduce((s, d) => s + d.views, 0);
  const revenue = campaign.memberships
    .map((m) => m.affiliateAsset?.revenueCents || 0)
    .reduce((s, n) => s + n, 0);
  const clicks = campaign.memberships
    .map((m) => m.affiliateAsset?.clicks || 0)
    .reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title={campaign.title}
        description={campaign.objective || undefined}
        actions={
          <>
            <Badge status={campaign.status} />
            <Link
              href={`/preview/${campaign.previewToken}`}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium"
              target="_blank"
            >
              Preview brief
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
          {campaign.compModel}
        </span>
        {parseJsonArray(campaign.platforms).map((p) => (
          <span key={p} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            {p}
          </span>
        ))}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
          Fee {formatMoney(campaign.feeCents)}
        </span>
        {campaign.affiliateRate ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            Affiliate {formatPercent(campaign.affiliateRate)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Creators" value={String(campaign.memberships.length)} />
        <Stat
          label="Applications"
          value={String(campaign.applications.filter((a) => a.status === "pending").length)}
          hint="pending"
        />
        <Stat label="Tracked views" value={formatNumber(totalViews)} />
        <Stat
          label="Affiliate"
          value={formatMoney(revenue)}
          hint={`${formatNumber(clicks)} clicks`}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <h2 className="font-semibold text-slate-900">Applications</h2>
            <div className="mt-4 space-y-4">
              {campaign.applications.length === 0 ? (
                <p className="text-sm text-slate-500">No applications yet.</p>
              ) : (
                campaign.applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {app.creator.user.name}{" "}
                          <span className="text-slate-400">@{app.creator.handle}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{app.pitch}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Proposed {formatMoney(app.proposedFeeCents)} · {app.timeline}
                        </p>
                      </div>
                      <Badge status={app.status === "pending" ? "APPLIED" : app.status.toUpperCase()} />
                    </div>
                    {app.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <form action={reviewApplication}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="decision" value="accept" />
                          <Button type="submit">Accept</Button>
                        </form>
                        <form action={reviewApplication}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <Button type="submit" variant="secondary">
                            Reject
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900">Creators & deliverables</h2>
            <div className="mt-4 space-y-6">
              {campaign.memberships.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {m.creator.user.name}{" "}
                        <span className="text-slate-400">@{m.creator.handle}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Offer {formatMoney(m.offeredFeeCents)} · ER{" "}
                        {formatPercent(m.creator.engagementRate)}
                      </p>
                    </div>
                    <Badge status={m.status} />
                  </div>

                  {m.affiliateAsset ? (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Affiliate <code className="font-mono">{m.affiliateAsset.trackingCode}</code>
                      {" · "}
                      code <code className="font-mono">{m.affiliateAsset.promoCode}</code>
                      {" · "}
                      {formatNumber(m.affiliateAsset.clicks)} clicks ·{" "}
                      {formatMoney(m.affiliateAsset.revenueCents)} revenue
                      <div>
                        <Link
                          className="text-violet-600"
                          href={`/r/${m.affiliateAsset.trackingCode}`}
                        >
                          Test tracking link
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {m.deliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {d.platform} · {d.contentType}
                          </p>
                          <p className="text-xs text-slate-500">
                            {d.postUrl || "No URL yet"}
                            {d.views
                              ? ` · ${formatNumber(d.views)} views · ER ${formatPercent(d.engagementRate)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge status={d.status} />
                          {d.status === "SUBMITTED" || d.status === "LIVE" ? (
                            <>
                              <form action={markDeliverable}>
                                <input type="hidden" name="deliverableId" value={d.id} />
                                <input type="hidden" name="action" value="sync" />
                                <Button type="submit" variant="secondary">
                                  Sync metrics
                                </Button>
                              </form>
                              {d.status === "SUBMITTED" ? (
                                <form action={markDeliverable}>
                                  <input type="hidden" name="deliverableId" value={d.id} />
                                  <input type="hidden" name="action" value="approve" />
                                  <Button type="submit">Approve</Button>
                                </form>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {m.messages[0] ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Last outreach: {m.messages[0].subject}
                    </p>
                  ) : null}

                  {!m.payouts.some((p) => p.status === "PAID") &&
                  ["ACTIVE", "DELIVERABLES_SUBMITTED", "VERIFIED"].includes(m.status) ? (
                    <form action={createPayout} className="mt-3">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <Button type="submit" variant="secondary">
                        Mark fee paid ({formatMoney(m.offeredFeeCents || campaign.feeCents)})
                      </Button>
                    </form>
                  ) : m.payouts[0] ? (
                    <p className="mt-3 text-xs font-medium text-emerald-700">
                      Paid {formatMoney(m.payouts[0].amountCents)} · {m.payouts[0].reference}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-slate-900">Invite creator</h2>
            <form action={inviteCreator} className="mt-4 space-y-3">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Select name="creatorId" label="Creator" required defaultValue="">
                <option value="" disabled>
                  Select creator
                </option>
                {allCreators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.user.name} (@{c.handle})
                  </option>
                ))}
              </Select>
              <Select name="templateId" label="Template" defaultValue={templates[0]?.id || ""}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Input
                name="feeCents"
                label="Offered fee (USD)"
                type="number"
                defaultValue={campaign.feeCents ? String(campaign.feeCents / 100) : ""}
              />
              <Button type="submit">Send outreach</Button>
            </form>
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900">Brief</h2>
            <div className="prose-brief mt-3 whitespace-pre-wrap">{campaign.brief}</div>
          </Card>
          <Card>
            <h2 className="font-semibold text-slate-900">Terms</h2>
            <div className="prose-brief mt-3 whitespace-pre-wrap">{campaign.terms}</div>
          </Card>
          <Card>
            <h2 className="font-semibold text-slate-900">Deliverable requirements</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {campaign.requirements.map((r) => (
                <li key={r.id}>
                  {r.quantity}× {r.platform} {r.contentType}
                  {r.description ? ` — ${r.description}` : ""}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
