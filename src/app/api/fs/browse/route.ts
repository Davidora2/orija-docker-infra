import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSubfolder, listDirectory } from "@/lib/fs-dest";

async function requireAuth() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Unauthorized");
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const dir = searchParams.get("path") ?? undefined;
    const data = await listDirectory(dir || undefined);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browse failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = (await request.json()) as {
      parentPath?: string;
      name?: string;
    };
    if (!body.parentPath || !body.name) {
      return NextResponse.json(
        { error: "parentPath and name are required" },
        { status: 400 },
      );
    }
    const created = await createSubfolder(body.parentPath, body.name);
    return NextResponse.json({ path: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
