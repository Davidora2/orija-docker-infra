import Link from "next/link";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { inviteCreator } from "@/app/actions";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { contentMatchScore, parseJsonArray } from "@/lib/utils";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; niche?: string; campaignId?: string }>;
}) {
  const { q = "", niche = "", campaignId = "" } = await searchParams;
  const { workspace } = await getBrandContext();

  const [creators, campaigns, templates] = await Promise.all([
    prisma.creator.findMany({
      include: {
        user: true,
        socialAccounts: true,
        posts: { take: 2, orderBy: { postedAt: "desc" } },
      },
    }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.outreachTemplate.findMany({
      where: { workspaceId: workspace.id },
    }),
  ]);

  const ranked = creators
    .map((c) => {
      const topics = parseJsonArray(c.topics);
      const niches = parseJsonArray(c.niches);
      const score = contentMatchScore(q || niche, c.contentSummary, topics, niches);
      const followers = c.socialAccounts.reduce((s, a) => s + a.followerCount, 0);
      return { c, score, followers, topics, niches };
    })
    .filter((row) => {
      if (niche && !row.niches.some((n) => n.toLowerCase().includes(niche.toLowerCase()))) {
        return false;
      }
      if (q && row.score <= 0) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || b.followers - a.followers);

  const selectedCampaignId = campaignId || campaigns[0]?.id || "";

  return (
    <div>
      <PageHeader
        title="Discovery"
        description="Find influencers based on the content they share"
      />

      <Card className="mb-6">
        <form className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Input
              name="q"
              label="Content search"
              placeholder="e.g. vitamin C serum, glass skin, retinol"
              defaultValue={q}
            />
          </div>
          <Input
            name="niche"
            label="Niche filter"
            placeholder="beauty, skincare..."
            defaultValue={niche}
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Search content
            </Button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {["skincare", "retinol", "pilates", "meal prep", "ai tools"].map((chip) => (
            <Link
              key={chip}
              href={`/brand/discovery?q=${encodeURIComponent(chip)}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700"
            >
              {chip}
            </Link>
          ))}
        </div>
      </Card>

      {ranked.length === 0 ? (
        <EmptyState
          title="No creators matched"
          description="Try another content query or clear filters."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ranked.map(({ c, score, followers, topics, niches }) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.user.avatarUrl || ""}
                    alt=""
                    className="h-12 w-12 rounded-full bg-slate-100"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {c.user.name}{" "}
                      <span className="font-normal text-slate-400">@{c.handle}</span>
                    </p>
                    <p className="text-sm text-slate-500">{c.location}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.bio}</p>
                  </div>
                </div>
                {q ? (
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                    match {score}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {niches.map((n) => (
                  <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {n}
                  </span>
                ))}
                {topics.slice(0, 4).map((t) => (
                  <span key={t} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="font-semibold text-slate-900">{formatNumber(followers)}</p>
                  <p className="text-slate-500">followers</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="font-semibold text-slate-900">
                    {formatPercent(c.engagementRate)}
                  </p>
                  <p className="text-slate-500">ER</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="font-semibold text-slate-900">
                    {formatMoney(c.rateMinCents)}–{formatMoney(c.rateMaxCents)}
                  </p>
                  <p className="text-slate-500">rate</p>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {c.posts.map((p) => (
                  <p key={p.id} className="truncate text-xs text-slate-500">
                    {p.platform}: {p.caption}
                  </p>
                ))}
              </div>

              {selectedCampaignId ? (
                <form action={inviteCreator} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="creatorId" value={c.id} />
                  <input type="hidden" name="templateId" value={templates[0]?.id || ""} />
                  <Select
                    name="campaignId"
                    label="Invite to"
                    defaultValue={selectedCampaignId}
                    className="min-w-[180px]"
                  >
                    {campaigns.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.title}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit">Outreach</Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
