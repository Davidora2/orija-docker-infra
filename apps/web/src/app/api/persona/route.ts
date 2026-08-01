import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const persona = body.persona === "creator" ? "creator" : "brand";
  const res = NextResponse.json({ ok: true, persona });
  res.cookies.set("cm_persona", persona, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
  return res;
}
