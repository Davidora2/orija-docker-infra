import { Card, PageHeader, Stat } from "@/components/ui";
import { getCreatorContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function CreatorEarningsPage() {
  const { creator } = await getCreatorContext();

  const memberships = await prisma.campaignCreator.findMany({
    where: { creatorId: creator.id },
    include: {
      campaign: true,
      payouts: true,
      commissions: true,
      affiliateAsset: true,
    },
  });

  const payouts = memberships.flatMap((m) =>
    m.payouts.map((p) => ({ ...p, campaign: m.campaign.title })),
  );
  const commissions = memberships.flatMap((m) =>
    m.commissions.map((c) => ({ ...c, campaign: m.campaign.title })),
  );
  const paid = payouts
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amountCents, 0);
  const commissionTotal = commissions.reduce((s, c) => s + c.amountCents, 0);

  return (
    <div>
      <PageHeader title="Earnings" description="Fees and affiliate commissions" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Fees paid" value={formatMoney(paid)} />
        <Stat label="Commissions" value={formatMoney(commissionTotal)} />
        <Stat label="Total" value={formatMoney(paid + commissionTotal)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">Payouts</h2>
          <div className="mt-4 space-y-3">
            {payouts.length === 0 ? (
              <p className="text-sm text-slate-500">No payouts yet.</p>
            ) : (
              payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{p.campaign}</p>
                    <p className="text-xs text-slate-500">{p.reference}</p>
                  </div>
                  <p className="font-semibold">{formatMoney(p.amountCents)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Affiliate commissions</h2>
          <div className="mt-4 space-y-3">
            {commissions.length === 0 ? (
              <p className="text-sm text-slate-500">No commissions yet.</p>
            ) : (
              commissions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{c.campaign}</p>
                    <p className="text-xs text-slate-500">{c.orderRef || c.note}</p>
                  </div>
                  <p className="font-semibold">{formatMoney(c.amountCents)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
