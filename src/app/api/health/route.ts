import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Healthcheck Docker. Public (exclu de l'auth), ne renvoie aucune donnée. */
export async function GET() {
  try {
    getDb().get(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
