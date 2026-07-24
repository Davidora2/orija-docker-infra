import { NextResponse } from "next/server";
import { listDriveChildren } from "@/lib/drive";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") ?? "root";
    const pageToken = searchParams.get("pageToken") ?? undefined;
    const data = await listDriveChildren(folderId, pageToken);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
