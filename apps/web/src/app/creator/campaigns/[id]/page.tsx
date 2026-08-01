import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { submitDeliverable } from "@/app/actions";
import { getCreatorContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export default async function CreatorCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { creator } = await getCreatorContext();

  const membership = await prisma.campaignCreator.findUnique({
    where: {
      campaignId_creatorId: { campaignId: id, creatorId: creator.id },
    },
    include: {
      campaign: { include: { workspace: true, requirements: true } },
      deliverables: { orderBy: { createdAt: "asc" } },
      affiliateAsset: true,
      payouts: true,
      commissions: true,
    },
  });
  if (!membership) notFound();

  const c = membership.campaign;

  return (
    <div>
      <PageHeader
        title={c.title}
        description={`${c.workspace.name} · ${c.compModel}`}
        actions={<Badge status={membership.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="font-semibold text-slate-900">Deliverables</h2>
            <div className="mt-4 space-y-4">
              {membership.deliverables.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {d.platform} · {d.contentType}
                    </p>
                    <Badge status={d.status} />
                  </div>
                  {d.postUrl ? (
                    <p className="mt-2 text-sm text-slate-600">
                      <a className="text-violet-600" href={d.postUrl} target="_blank">
                        {d.postUrl}
                      </a>
                      {d.views ? (
                        <span className="text-slate-500">
                          {" "}
                          · {formatNumber(d.views)} views · ER{" "}
                          {formatPercent(d.engagementRate)}
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  {["PENDING", "NEEDS_REVISION"].includes(d.status) ? (
                    <form action={submitDeliverable} className="mt-3 space-y-3">
                      <input type="hidden" name="deliverableId" value={d.id} />
                      <Input
                        name="postUrl"
                        label="Live post URL"
                        placeholder="https://..."
                        required
                      />
                      <Textarea name="caption" label="Caption (optional)" rows={2} />
                      <Button type="submit">Submit post</Button>
                    </form>
                  ) : null}
                </div>
              ))}
              {membership.deliverables.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Deliverables appear after your application is accepted.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Brief & terms</h2>
              <Link
                href={`/preview/${c.previewToken}`}
                className="text-sm text-violet-600"
              >
                Full preview
              </Link>
            </div>
            <div className="prose-brief mt-3 whitespace-pre-wrap">{c.brief}</div>
            <hr className="my-4 border-slate-100" />
            <div className="prose-brief whitespace-pre-wrap">{c.terms}</div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-slate-900">Compensation</h2>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatMoney(membership.offeredFeeCents || c.feeCents)}
            </p>
            {c.affiliateRate ? (
              <p className="mt-1 text-sm text-slate-500">
                + {formatPercent(c.affiliateRate)} affiliate
              </p>
            ) : null}
            {membership.payouts[0] ? (
              <p className="mt-3 text-sm text-emerald-700">
                Paid {formatMoney(membership.payouts[0].amountCents)}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Fee payout pending verification</p>
            )}
            {membership.commissions.length > 0 ? (
              <p className="mt-1 text-sm text-slate-600">
                Commissions{" "}
                {formatMoney(
                  membership.commissions.reduce((s, x) => s + x.amountCents, 0),
                )}
              </p>
            ) : null}
          </Card>

          {membership.affiliateAsset ? (
            <Card>
              <h2 className="font-semibold text-slate-900">Affiliate assets</h2>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  Tracking code:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                    {membership.affiliateAsset.trackingCode}
                  </code>
                </p>
                <p>
                  Promo code:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                    {membership.affiliateAsset.promoCode}
                  </code>
                </p>
                <p className="text-slate-500">
                  {formatNumber(membership.affiliateAsset.clicks)} clicks ·{" "}
                  {formatNumber(membership.affiliateAsset.conversions)} conv ·{" "}
                  {formatMoney(membership.affiliateAsset.revenueCents)}
                </p>
                <Link
                  className="text-violet-600"
                  href={`/r/${membership.affiliateAsset.trackingCode}`}
                >
                  Open tracking link
                </Link>
              </div>
            </Card>
          ) : null}

          {c.giftDescription ? (
            <Card>
              <h2 className="font-semibold text-slate-900">Product gift</h2>
              <p className="mt-2 text-sm text-slate-600">{c.giftDescription}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
