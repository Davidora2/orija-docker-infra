import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { trackAffiliateClick } from "@/app/actions";

export default async function AffiliateRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const existing =
    (await prisma.affiliateAsset.findUnique({ where: { trackingCode: code } })) ||
    (await prisma.affiliateAsset.findUnique({
      where: { trackingCode: code.toUpperCase() },
    }));
  if (!existing) notFound();
  const asset = await trackAffiliateClick(existing.trackingCode);
  if (!asset) notFound();
  redirect(asset.landingUrl);
}
