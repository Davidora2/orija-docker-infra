import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.affiliateEvent.deleteMany();
  await prisma.commissionEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.affiliateAsset.deleteMany();
  await prisma.message.deleteMany();
  await prisma.application.deleteMany();
  await prisma.campaignCreator.deleteMany();
  await prisma.deliverableRequirement.deleteMany();
  await prisma.outreachTemplate.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.creatorListItem.deleteMany();
  await prisma.creatorList.deleteMany();
  await prisma.creatorPost.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const brandUser = await prisma.user.create({
    data: {
      email: "brand@creatomatch.app",
      name: "Alex Rivera",
      role: "BRAND",
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Orija Beauty",
      slug: "orija-beauty",
      members: {
        create: { userId: brandUser.id, role: "admin" },
      },
    },
  });

  const creatorsSeed = [
    {
      email: "maya@creators.app",
      name: "Maya Chen",
      handle: "maya.glow",
      bio: "Clean beauty & skincare educator. UGC + long-form TikTok.",
      niches: ["beauty", "skincare", "clean beauty"],
      topics: ["retinol", "glass skin", "sunscreen", "routine"],
      location: "Los Angeles, US",
      engagementRate: 4.8,
      authenticityScore: 92,
      rateMinCents: 80000,
      rateMaxCents: 150000,
      content: [
        "My AM glass skin routine with mineral sunscreen #skincare #glassskin",
        "Retinol beginners guide — what I wish I knew #retinol #cleanbeauty",
        "Honest review: barrier repair serums for sensitive skin",
      ],
      socials: [
        { platform: "INSTAGRAM", handle: "maya.glow", followers: 128000, avgViews: 22000 },
        { platform: "TIKTOK", handle: "maya.glow", followers: 340000, avgViews: 95000 },
      ],
    },
    {
      email: "jordan@creators.app",
      name: "Jordan Blake",
      handle: "jordaneats",
      bio: "Home cooking + kitchen gadgets. Affiliate-friendly recipes.",
      niches: ["food", "cooking", "kitchen"],
      topics: ["meal prep", "air fryer", "protein", "weeknight"],
      location: "Austin, US",
      engagementRate: 3.6,
      authenticityScore: 88,
      rateMinCents: 50000,
      rateMaxCents: 90000,
      content: [
        "15-minute high protein meal prep bowls #mealprep",
        "Air fryer chicken that actually stays juicy",
        "Weeknight pasta with pantry staples",
      ],
      socials: [
        { platform: "INSTAGRAM", handle: "jordaneats", followers: 86000, avgViews: 12000 },
        { platform: "YOUTUBE", handle: "JordanEats", followers: 42000, avgViews: 18000 },
      ],
    },
    {
      email: "sofia@creators.app",
      name: "Sofia Martel",
      handle: "sofiamoves",
      bio: "Fitness + recovery. Pilates and wellness lifestyle.",
      niches: ["fitness", "wellness", "pilates"],
      topics: ["mobility", "recovery", "mat pilates", "habits"],
      location: "Miami, US",
      engagementRate: 5.2,
      authenticityScore: 95,
      rateMinCents: 70000,
      rateMaxCents: 120000,
      content: [
        "10-minute mat pilates for desk workers #pilates #mobility",
        "Recovery stack after heavy training days",
        "Building sustainable workout habits in 2026",
      ],
      socials: [
        { platform: "INSTAGRAM", handle: "sofiamoves", followers: 210000, avgViews: 31000 },
        { platform: "TIKTOK", handle: "sofiamoves", followers: 510000, avgViews: 140000 },
      ],
    },
    {
      email: "leo@creators.app",
      name: "Leo Nguyen",
      handle: "leotechlife",
      bio: "Tech reviews & creator tools for small brands.",
      niches: ["tech", "productivity", "saas"],
      topics: ["ai tools", "cameras", "editing", "workflows"],
      location: "Seattle, US",
      engagementRate: 2.9,
      authenticityScore: 90,
      rateMinCents: 100000,
      rateMaxCents: 200000,
      content: [
        "Best budget cameras for UGC creators in 2026",
        "AI editing workflow that saves me 5 hours/week",
        "Tools I use to manage brand deals",
      ],
      socials: [
        { platform: "YOUTUBE", handle: "LeoTechLife", followers: 175000, avgViews: 45000 },
        { platform: "X", handle: "leotechlife", followers: 38000, avgViews: 4000 },
      ],
    },
    {
      email: "priya@creators.app",
      name: "Priya Shah",
      handle: "priyaskinlab",
      bio: "Dermatology-inspired skincare explainers. Science meets glow.",
      niches: ["beauty", "skincare", "science"],
      topics: ["niacinamide", "spf", "hyperpigmentation", "barrier"],
      location: "New York, US",
      engagementRate: 6.1,
      authenticityScore: 97,
      rateMinCents: 120000,
      rateMaxCents: 220000,
      content: [
        "Niacinamide myths vs evidence #skincare #science",
        "Hyperpigmentation routine that is actually gentle",
        "Why your barrier is breaking (and how to fix it)",
      ],
      socials: [
        { platform: "INSTAGRAM", handle: "priyaskinlab", followers: 95000, avgViews: 28000 },
        { platform: "TIKTOK", handle: "priyaskinlab", followers: 220000, avgViews: 110000 },
      ],
    },
  ];

  const creators = [];
  for (const c of creatorsSeed) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        name: c.name,
        role: "CREATOR",
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(c.name)}`,
        creator: {
          create: {
            handle: c.handle,
            bio: c.bio,
            niches: JSON.stringify(c.niches),
            topics: JSON.stringify(c.topics),
            location: c.location,
            engagementRate: c.engagementRate,
            authenticityScore: c.authenticityScore,
            rateMinCents: c.rateMinCents,
            rateMaxCents: c.rateMaxCents,
            contentSummary: c.content.join(" | "),
            paymentReady: true,
            socialAccounts: {
              create: c.socials.map((s) => ({
                platform: s.platform,
                handle: s.handle,
                followerCount: s.followers,
                avgViews: s.avgViews,
                isConnected: true,
                lastSyncedAt: new Date(),
                url: `https://example.com/${s.handle}`,
              })),
            },
            posts: {
              create: c.content.map((caption, i) => ({
                platform: c.socials[i % c.socials.length].platform,
                caption,
                hashtags: JSON.stringify(
                  (caption.match(/#\w+/g) || []).map((h) => h.slice(1)),
                ),
                topics: JSON.stringify(c.topics.slice(0, 2)),
                likes: 1200 + i * 340,
                comments: 80 + i * 12,
                views: 15000 + i * 8000,
                shares: 40 + i * 9,
                postedAt: new Date(Date.now() - (i + 1) * 86400000 * 3),
              })),
            },
          },
        },
      },
      include: { creator: true },
    });
    creators.push(user.creator!);
  }

  const beautyList = await prisma.creatorList.create({
    data: {
      workspaceId: workspace.id,
      name: "Beauty US Mid-tier",
      description: "Skincare creators for spring campaign",
      items: {
        create: creators
          .filter((c) => ["maya.glow", "priyaskinlab", "sofiamoves"].includes(c.handle))
          .map((c) => ({ creatorId: c.id })),
      },
    },
  });

  const inviteTemplate = await prisma.outreachTemplate.create({
    data: {
      workspaceId: workspace.id,
      name: "Campaign invite — warm",
      subject: "{{brand}} collab: {{campaign}}",
      body: `Hi {{first_name}},

We loved your recent content around {{topics}} and think you'd be a great fit for {{campaign}}.

Fee: {{fee}}
Deliverables are in the brief — preview here: {{brief_link}}

Would love to partner if the vibe feels right.

— {{brand_manager}}`,
      channel: "email",
    },
  });

  await prisma.outreachTemplate.create({
    data: {
      workspaceId: workspace.id,
      name: "Reminder — brief preview",
      subject: "Quick nudge: {{campaign}} brief is ready",
      body: `Hey {{first_name}}, just floating this again in case it got buried.

Preview brief + terms: {{brief_link}}

Happy to answer questions on usage rights or timeline.`,
      channel: "email",
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      title: "Spring Glow Serum Launch",
      slug: "spring-glow-serum",
      status: "ACTIVE",
      objective: "Drive awareness + affiliate sales for new vitamin C serum",
      platforms: JSON.stringify(["INSTAGRAM", "TIKTOK"]),
      brief: `## Campaign brief

Help us launch **Orija Glow Serum C15** with authentic skincare content.

### Creative direction
- Show AM routine integration
- Focus on texture, glow, and sensitive-skin friendliness
- Mention SPF pairing (no medical claims)

### Required talking points
1. 15% vitamin C derivative
2. Fragrance-free
3. Suitable for combination skin

### Assets
Product ship + digital lookbook available after acceptance.`,
      terms: `## Terms & usage rights

- Content usage: paid organic + whitelisting for 90 days
- Exclusivity: no competing vitamin C serums for 30 days
- Disclosure: #ad / paid partnership label required
- Revisions: 1 round of brand feedback on draft (optional)
- Payment: Net-7 after live post verification
- Affiliate: 15% commission for 30-day cookie window`,
      dosAndDonts: `Do: natural lighting, honest review tone, link in bio during flight.
Don't: make disease claims, compare to prescription products, use filters that alter skin tone dramatically.`,
      compModel: "HYBRID",
      budgetCents: 2500000,
      feeCents: 120000,
      giftDescription: "Full-size Glow Serum C15 + travel SPF",
      affiliateRate: 0.15,
      applicationOpen: true,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      requirements: {
        create: [
          {
            platform: "TIKTOK",
            contentType: "video",
            quantity: 1,
            description: "15–30s routine / texture video",
            dueDays: 14,
          },
          {
            platform: "INSTAGRAM",
            contentType: "reel",
            quantity: 1,
            description: "Reel with product demo",
            dueDays: 14,
          },
          {
            platform: "INSTAGRAM",
            contentType: "story",
            quantity: 2,
            description: "Story frames with swipe-up / link sticker",
            dueDays: 14,
          },
        ],
      },
    },
    include: { requirements: true },
  });

  await prisma.outreachTemplate.update({
    where: { id: inviteTemplate.id },
    data: { campaignId: campaign.id },
  });

  const maya = creators.find((c) => c.handle === "maya.glow")!;
  const priya = creators.find((c) => c.handle === "priyaskinlab")!;
  const sofia = creators.find((c) => c.handle === "sofiamoves")!;

  const mayaMembership = await prisma.campaignCreator.create({
    data: {
      campaignId: campaign.id,
      creatorId: maya.id,
      status: "ACTIVE",
      offeredFeeCents: 120000,
      invitedAt: new Date(Date.now() - 86400000 * 10),
      appliedAt: new Date(Date.now() - 86400000 * 8),
      acceptedAt: new Date(Date.now() - 86400000 * 7),
      affiliateAsset: {
        create: {
          trackingCode: "MAYA-GLOW15",
          landingUrl: "https://orija.example/products/glow-serum?ref=MAYA-GLOW15",
          promoCode: "MAYAGLOW15",
          clicks: 842,
          conversions: 37,
          revenueCents: 444000,
        },
      },
      deliverables: {
        create: [
          {
            requirementId: campaign.requirements[0].id,
            platform: "TIKTOK",
            contentType: "video",
            status: "LIVE",
            postUrl: "https://tiktok.com/@maya.glow/video/demo1",
            caption: "AM glow with Orija C15 #ad",
            submittedAt: new Date(Date.now() - 86400000 * 3),
            approvedAt: new Date(Date.now() - 86400000 * 2),
            liveAt: new Date(Date.now() - 86400000 * 2),
            views: 128000,
            likes: 9400,
            comments: 312,
            shares: 880,
            saves: 2100,
            impressions: 160000,
            reach: 121000,
            engagementRate: 9.8,
            lastSyncedAt: new Date(),
          },
          {
            requirementId: campaign.requirements[1].id,
            platform: "INSTAGRAM",
            contentType: "reel",
            status: "SUBMITTED",
            postUrl: "https://instagram.com/reel/demo2",
            caption: "Texture close-up + routine #ad",
            submittedAt: new Date(Date.now() - 86400000 * 1),
            views: 0,
            likes: 0,
          },
          {
            requirementId: campaign.requirements[2].id,
            platform: "INSTAGRAM",
            contentType: "story",
            status: "PENDING",
          },
        ],
      },
      commissions: {
        create: [
          {
            amountCents: 66600,
            orderRef: "ORD-10021",
            note: "Affiliate conversions week 1",
          },
        ],
      },
    },
  });

  await prisma.application.create({
    data: {
      campaignId: campaign.id,
      creatorId: maya.id,
      pitch:
        "I can film a glass-skin AM routine featuring texture shots and an honest first-impression. Audience skews 25–34 women interested in clean actives.",
      proposedFeeCents: 120000,
      timeline: "Draft in 5 days, live within 10",
      status: "accepted",
    },
  });

  await prisma.message.create({
    data: {
      campaignCreatorId: mayaMembership.id,
      senderUserId: brandUser.id,
      subject: "Orija Beauty collab: Spring Glow Serum Launch",
      body: "Hi Maya, we loved your glass skin content and think you'd be perfect for our serum launch. Preview the brief when you can!",
      templateId: inviteTemplate.id,
      isOutreach: true,
    },
  });

  await prisma.campaignCreator.create({
    data: {
      campaignId: campaign.id,
      creatorId: priya.id,
      status: "APPLIED",
      offeredFeeCents: 150000,
      invitedAt: new Date(Date.now() - 86400000 * 4),
      appliedAt: new Date(Date.now() - 86400000 * 1),
    },
  });

  await prisma.application.create({
    data: {
      campaignId: campaign.id,
      creatorId: priya.id,
      pitch:
        "Science-led explainer on vitamin C derivatives + a gentle routine demo. Strong save rate on educational skincare posts.",
      proposedFeeCents: 150000,
      timeline: "Can go live next week",
      status: "pending",
    },
  });

  await prisma.campaignCreator.create({
    data: {
      campaignId: campaign.id,
      creatorId: sofia.id,
      status: "INVITED",
      offeredFeeCents: 100000,
    },
  });

  // Second campaign draft
  await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      title: "UGC Whitelisting Pack — Q3",
      slug: "ugc-whitelisting-q3",
      status: "DRAFT",
      objective: "Collect reusable UGC for Meta ads",
      platforms: JSON.stringify(["INSTAGRAM"]),
      brief: "Need raw UGC testimonials for ads. Hook in first 3 seconds.",
      terms: "Perpetual ads usage. Buyout fee. No exclusivity.",
      compModel: "PAID",
      feeCents: 75000,
      budgetCents: 750000,
      applicationOpen: false,
    },
  });

  console.log("Seeded CreatoMatch demo data");
  console.log({ workspace: workspace.slug, campaign: campaign.slug, list: beautyList.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
