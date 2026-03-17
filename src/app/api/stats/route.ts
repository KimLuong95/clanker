import { NextResponse } from "next/server";
import { fetchStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const stats = await fetchStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
