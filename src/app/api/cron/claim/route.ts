import { NextRequest, NextResponse } from "next/server";
import { claimFees } from "@/lib/claim";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await claimFees();
  const ok = result.status !== "error";
  return NextResponse.json(result, { status: ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = req.nextUrl.searchParams.get("secret");

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await claimFees();
  const ok = result.status !== "error";
  return NextResponse.json(result, { status: ok ? 200 : 500 });
}
