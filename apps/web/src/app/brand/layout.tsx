import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, persona } = await getCurrentUser();
  if (persona !== "brand") redirect("/creator");
  return (
    <AppShell
      persona="brand"
      userName={user.name}
      workspaceName={user.workspaceMembers[0]?.workspace.name}
    >
      {children}
    </AppShell>
  );
}
