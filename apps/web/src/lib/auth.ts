import { cookies } from "next/headers";
import { prisma } from "./db";

export type DemoPersona = "brand" | "creator";

export const DEMO_BRAND_EMAIL = "brand@creatomatch.app";
export const DEMO_CREATOR_EMAIL = "maya@creators.app";

export async function getDemoPersona(): Promise<DemoPersona> {
  const jar = await cookies();
  const value = jar.get("cm_persona")?.value;
  return value === "creator" ? "creator" : "brand";
}

export async function getCurrentUser() {
  const persona = await getDemoPersona();
  const email = persona === "creator" ? DEMO_CREATOR_EMAIL : DEMO_BRAND_EMAIL;
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaceMembers: { include: { workspace: true } },
      creator: {
        include: {
          socialAccounts: true,
        },
      },
    },
  });
  if (!user) {
    throw new Error("Demo data missing. Run `pnpm db:seed` from apps/web.");
  }
  return { user, persona };
}

export async function getBrandContext() {
  const { user, persona } = await getCurrentUser();
  if (persona !== "brand") {
    throw new Error("Brand context required");
  }
  const membership = user.workspaceMembers[0];
  if (!membership) throw new Error("Brand workspace missing");
  return { user, workspace: membership.workspace, membership };
}

export async function getCreatorContext() {
  const { user, persona } = await getCurrentUser();
  if (persona !== "creator" || !user.creator) {
    throw new Error("Creator context required");
  }
  return { user, creator: user.creator };
}
