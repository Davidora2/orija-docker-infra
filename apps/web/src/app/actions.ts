"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getBrandContext, getCreatorContext } from "@/lib/auth";
import { slugify, toJsonArray } from "@/lib/utils";
import { customAlphabet } from "nanoid";

const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

function revalidateBrand(campaignId?: string) {
  revalidatePath("/brand");
  revalidatePath("/brand/campaigns");
  revalidatePath("/brand/discovery");
  revalidatePath("/brand/analytics");
  revalidatePath("/creator");
  revalidatePath("/creator/opportunities");
  revalidatePath("/creator/campaigns");
  revalidatePath("/creator/earnings");
  if (campaignId) {
    revalidatePath(`/brand/campaigns/${campaignId}`);
  }
}

export async function createCampaign(formData: FormData) {
  const { workspace } = await getBrandContext();
  const title = String(formData.get("title") || "").trim();
  const brief = String(formData.get("brief") || "").trim();
  const terms = String(formData.get("terms") || "").trim();
  const compModel = String(formData.get("compModel") || "PAID");
  const feeCents = Number(formData.get("feeCents") || 0) * 100;
  const affiliateRate = Number(formData.get("affiliateRate") || 0) / 100;
  const objective = String(formData.get("objective") || "");
  const platforms = String(formData.get("platforms") || "INSTAGRAM,TIKTOK")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (!title || !brief || !terms) {
    throw new Error("Title, brief, and terms are required");
  }

  const baseSlug = slugify(title) || "campaign";
  let slug = baseSlug;
  let i = 1;
  while (
    await prisma.campaign.findFirst({
      where: { workspaceId: workspace.id, slug },
    })
  ) {
    slug = `${baseSlug}-${i++}`;
  }

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      title,
      slug,
      status: "ACTIVE",
      objective,
      platforms: toJsonArray(platforms),
      brief,
      terms,
      compModel,
      feeCents: feeCents || null,
      affiliateRate: affiliateRate || null,
      applicationOpen: true,
      requirements: {
        create: platforms.slice(0, 2).map((platform) => ({
          platform,
          contentType: platform === "TIKTOK" ? "video" : "reel",
          quantity: 1,
          description: `${platform} deliverable`,
          dueDays: 14,
        })),
      },
    },
  });

  revalidateBrand(campaign.id);
  return campaign.id;
}

export async function inviteCreator(formData: FormData) {
  const { user, workspace } = await getBrandContext();
  const campaignId = String(formData.get("campaignId"));
  const creatorId = String(formData.get("creatorId"));
  const templateId = String(formData.get("templateId") || "");
  const feeCents = Number(formData.get("feeCents") || 0) * 100;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
  });
  if (!campaign) throw new Error("Campaign not found");

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { user: true },
  });
  if (!creator) throw new Error("Creator not found");

  const template = templateId
    ? await prisma.outreachTemplate.findFirst({
        where: { id: templateId, workspaceId: workspace.id },
      })
    : await prisma.outreachTemplate.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "asc" },
      });

  const membership = await prisma.campaignCreator.upsert({
    where: {
      campaignId_creatorId: { campaignId, creatorId },
    },
    create: {
      campaignId,
      creatorId,
      status: "INVITED",
      offeredFeeCents: feeCents || campaign.feeCents,
    },
    update: {
      status: "INVITED",
      offeredFeeCents: feeCents || campaign.feeCents,
      invitedAt: new Date(),
    },
  });

  const briefLink = `/preview/${campaign.previewToken}`;
  const replacements: Record<string, string> = {
    "{{first_name}}": creator.user.name.split(" ")[0],
    "{{brand}}": workspace.name,
    "{{campaign}}": campaign.title,
    "{{fee}}": feeCents
      ? `$${feeCents / 100}`
      : campaign.feeCents
        ? `$${campaign.feeCents / 100}`
        : "TBD",
    "{{brief_link}}": briefLink,
    "{{brand_manager}}": user.name,
    "{{topics}}": JSON.parse(creator.topics || "[]").slice(0, 3).join(", "),
  };

  let subject = template?.subject || `Collab invite: ${campaign.title}`;
  let body =
    template?.body ||
    `Hi ${creator.user.name}, we'd love to collaborate on ${campaign.title}. Preview: ${briefLink}`;

  for (const [key, value] of Object.entries(replacements)) {
    subject = subject.split(key).join(value);
    body = body.split(key).join(value);
  }

  await prisma.message.create({
    data: {
      campaignCreatorId: membership.id,
      senderUserId: user.id,
      subject,
      body,
      templateId: template?.id,
      isOutreach: true,
    },
  });

  revalidateBrand(campaignId);
}

export async function reviewApplication(formData: FormData) {
  const { workspace } = await getBrandContext();
  const applicationId = String(formData.get("applicationId"));
  const decision = String(formData.get("decision")); // accept | reject

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { campaign: true },
  });
  if (!application || application.campaign.workspaceId !== workspace.id) {
    throw new Error("Application not found");
  }

  if (decision === "accept") {
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { status: "accepted" },
      });
      const membership = await tx.campaignCreator.upsert({
        where: {
          campaignId_creatorId: {
            campaignId: application.campaignId,
            creatorId: application.creatorId,
          },
        },
        create: {
          campaignId: application.campaignId,
          creatorId: application.creatorId,
          status: "ACTIVE",
          offeredFeeCents:
            application.proposedFeeCents || application.campaign.feeCents,
          appliedAt: application.createdAt,
          acceptedAt: new Date(),
        },
        update: {
          status: "ACTIVE",
          acceptedAt: new Date(),
          offeredFeeCents:
            application.proposedFeeCents || application.campaign.feeCents,
        },
      });

      const existingAsset = await tx.affiliateAsset.findUnique({
        where: { campaignCreatorId: membership.id },
      });
      if (
        !existingAsset &&
        (application.campaign.compModel === "AFFILIATE" ||
          application.campaign.compModel === "HYBRID")
      ) {
        const code = nano();
        await tx.affiliateAsset.create({
          data: {
            campaignCreatorId: membership.id,
            trackingCode: code,
            promoCode: code,
            landingUrl: `https://orija.example/products/glow-serum?ref=${code}`,
          },
        });
      }

      const requirements = await tx.deliverableRequirement.findMany({
        where: { campaignId: application.campaignId },
      });
      const existingDeliverables = await tx.deliverable.count({
        where: { campaignCreatorId: membership.id },
      });
      if (existingDeliverables === 0) {
        for (const req of requirements) {
          for (let q = 0; q < req.quantity; q++) {
            await tx.deliverable.create({
              data: {
                campaignCreatorId: membership.id,
                requirementId: req.id,
                platform: req.platform,
                contentType: req.contentType,
                status: "PENDING",
              },
            });
          }
        }
      }
    });
  } else {
    await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
        data: { status: "rejected" },
      }),
      prisma.campaignCreator.updateMany({
        where: {
          campaignId: application.campaignId,
          creatorId: application.creatorId,
        },
        data: { status: "REJECTED" },
      }),
    ]);
  }

  revalidateBrand(application.campaignId);
}

export async function markDeliverable(
  formData: FormData,
): Promise<void> {
  const { workspace } = await getBrandContext();
  const deliverableId = String(formData.get("deliverableId"));
  const action = String(formData.get("action")); // approve | revise | sync

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: {
      campaignCreator: { include: { campaign: true } },
    },
  });
  if (
    !deliverable ||
    deliverable.campaignCreator.campaign.workspaceId !== workspace.id
  ) {
    throw new Error("Deliverable not found");
  }

  if (action === "approve") {
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        status: "LIVE",
        approvedAt: new Date(),
        liveAt: new Date(),
      },
    });
  } else if (action === "revise") {
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: { status: "NEEDS_REVISION" },
    });
  } else if (action === "sync") {
    const views = 20000 + Math.floor(Math.random() * 90000);
    const likes = Math.floor(views * (0.04 + Math.random() * 0.06));
    const comments = Math.floor(likes * 0.04);
    const shares = Math.floor(likes * 0.08);
    const saves = Math.floor(likes * 0.15);
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        views,
        likes,
        comments,
        shares,
        saves,
        impressions: Math.floor(views * 1.2),
        reach: Math.floor(views * 0.9),
        engagementRate: Number((((likes + comments + shares + saves) / views) * 100).toFixed(2)),
        lastSyncedAt: new Date(),
        status: deliverable.status === "SUBMITTED" ? "LIVE" : deliverable.status,
        liveAt: deliverable.liveAt || new Date(),
      },
    });
  }

  revalidateBrand(deliverable.campaignCreator.campaignId);
}

export async function createPayout(formData: FormData) {
  const { workspace } = await getBrandContext();
  const membershipId = String(formData.get("membershipId"));

  const membership = await prisma.campaignCreator.findUnique({
    where: { id: membershipId },
    include: { campaign: true, payouts: true },
  });
  if (!membership || membership.campaign.workspaceId !== workspace.id) {
    throw new Error("Membership not found");
  }

  const amount =
    membership.offeredFeeCents || membership.campaign.feeCents || 0;
  if (!amount) throw new Error("No fee configured");

  await prisma.payout.create({
    data: {
      campaignCreatorId: membershipId,
      amountCents: amount,
      status: "PAID",
      method: "stripe_demo",
      reference: `pay_${nano()}`,
      paidAt: new Date(),
    },
  });

  await prisma.campaignCreator.update({
    where: { id: membershipId },
    data: { status: "PAID", completedAt: new Date() },
  });

  revalidateBrand(membership.campaignId);
}

export async function createTemplate(formData: FormData) {
  const { workspace } = await getBrandContext();
  const name = String(formData.get("name") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!name || !subject || !body) throw new Error("All fields required");

  await prisma.outreachTemplate.create({
    data: {
      workspaceId: workspace.id,
      name,
      subject,
      body,
      channel: "email",
    },
  });
  revalidatePath("/brand/templates");
}

export async function applyToCampaign(formData: FormData) {
  const { creator } = await getCreatorContext();
  const campaignId = String(formData.get("campaignId"));
  const pitch = String(formData.get("pitch") || "").trim();
  const timeline = String(formData.get("timeline") || "").trim();
  const proposedFeeCents = Number(formData.get("proposedFee") || 0) * 100;

  if (!pitch) throw new Error("Pitch required");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.applicationOpen || campaign.status !== "ACTIVE") {
    throw new Error("Campaign not open");
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.upsert({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
      create: {
        campaignId,
        creatorId: creator.id,
        pitch,
        timeline,
        proposedFeeCents: proposedFeeCents || null,
        status: "pending",
      },
      update: {
        pitch,
        timeline,
        proposedFeeCents: proposedFeeCents || null,
        status: "pending",
      },
    });

    await tx.campaignCreator.upsert({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
      create: {
        campaignId,
        creatorId: creator.id,
        status: "APPLIED",
        appliedAt: new Date(),
        offeredFeeCents: proposedFeeCents || campaign.feeCents,
      },
      update: {
        status: "APPLIED",
        appliedAt: new Date(),
        offeredFeeCents: proposedFeeCents || campaign.feeCents,
      },
    });
  });

  revalidateBrand(campaignId);
}

export async function markPreviewed(campaignId: string, token: string) {
  try {
    const { creator } = await getCreatorContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, previewToken: token },
    });
    if (!campaign) return;

    const membership = await prisma.campaignCreator.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
    });
    if (membership && membership.status === "INVITED") {
      await prisma.campaignCreator.update({
        where: { id: membership.id },
        data: { status: "PREVIEWED" },
      });
      revalidateBrand(campaignId);
    }
  } catch {
    // preview can be anonymous
  }
}

export async function submitDeliverable(formData: FormData) {
  const { creator } = await getCreatorContext();
  const deliverableId = String(formData.get("deliverableId"));
  const postUrl = String(formData.get("postUrl") || "").trim();
  const caption = String(formData.get("caption") || "").trim();

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { campaignCreator: true },
  });
  if (
    !deliverable ||
    deliverable.campaignCreator.creatorId !== creator.id
  ) {
    throw new Error("Deliverable not found");
  }
  if (!postUrl) throw new Error("Post URL required");

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      postUrl,
      caption,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  const pending = await prisma.deliverable.count({
    where: {
      campaignCreatorId: deliverable.campaignCreatorId,
      status: "PENDING",
    },
  });
  if (pending === 0) {
    await prisma.campaignCreator.update({
      where: { id: deliverable.campaignCreatorId },
      data: { status: "DELIVERABLES_SUBMITTED" },
    });
  }

  revalidateBrand(deliverable.campaignCreator.campaignId);
}

export async function trackAffiliateClick(code: string) {
  const asset = await prisma.affiliateAsset.findUnique({
    where: { trackingCode: code },
  });
  if (!asset) return null;
  await prisma.$transaction([
    prisma.affiliateAsset.update({
      where: { id: asset.id },
      data: { clicks: { increment: 1 } },
    }),
    prisma.affiliateEvent.create({
      data: { affiliateAssetId: asset.id, type: "click" },
    }),
  ]);
  return asset;
}
