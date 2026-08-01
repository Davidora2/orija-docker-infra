import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber, formatPercent } from "@/lib/format";
import { parseJsonArray } from "@/lib/utils";

export default async function ListsPage() {
  const { workspace } = await getBrandContext();
  const lists = await prisma.creatorList.findMany({
    where: { workspaceId: workspace.id },
    include: {
      items: {
        include: {
          creator: {
            include: { user: true, socialAccounts: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Community"
        description="Saved creator lists and relationship roster"
      />
      {lists.length === 0 ? (
        <EmptyState title="No lists" description="Lists appear when you save creators." />
      ) : (
        <div className="space-y-6">
          {lists.map((list) => (
            <Card key={list.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{list.name}</h2>
                  <p className="text-sm text-slate-500">{list.description}</p>
                </div>
                <span className="text-xs text-slate-500">{list.items.length} creators</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {list.items.map((item) => {
                  const followers = item.creator.socialAccounts.reduce(
                    (s, a) => s + a.followerCount,
                    0,
                  );
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-100 px-3 py-3"
                    >
                      <p className="font-medium text-slate-900">
                        {item.creator.user.name}{" "}
                        <span className="text-slate-400">@{item.creator.handle}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(followers)} followers · ER{" "}
                        {formatPercent(item.creator.engagementRate)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {parseJsonArray(item.creator.niches).map((n) => (
                          <span
                            key={n}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <Link
                        href={`/brand/discovery?q=${encodeURIComponent(parseJsonArray(item.creator.topics)[0] || "")}`}
                        className="mt-2 inline-block text-xs text-violet-600"
                      >
                        Find similar content
                      </Link>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
