import { NextResponse } from "next/server";
import { loadDashboard } from "@/lib/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard : chiffres clés, clients signés, devis en cours. */
export async function GET() {
  return NextResponse.json(loadDashboard());
}
