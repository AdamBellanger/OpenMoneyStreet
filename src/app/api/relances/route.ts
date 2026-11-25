import { NextResponse, type NextRequest } from "next/server";
import { todayParis, type FollowUpDTO } from "@/lib/domain";
import { loadFollowUps } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/relances[?date=AAAA-MM-JJ] : relances du jour et en retard, toutes villes. */
export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : todayParis();
  const places: FollowUpDTO[] = loadFollowUps(date);
  return NextResponse.json({ date, places });
}
