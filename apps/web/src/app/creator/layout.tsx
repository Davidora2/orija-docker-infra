import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, persona } = await getCurrentUser();
  if (persona !== "creator") redirect("/brand");
  return (
    <AppShell persona="creator" userName={user.name}>
      {children}
    </AppShell>
  );
}
