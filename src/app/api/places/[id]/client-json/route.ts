import { NextResponse, type NextRequest } from "next/server";
import { isValidPlaceId, placeIdFromSlug } from "@/lib/domain";
import { buildClientJson } from "@/lib/client-json";
import { getCity, loadPlace } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/places/node-123/client-json : télécharge client.json pour le générateur de sites. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = placeIdFromSlug((await params).id);
  if (!isValidPlaceId(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });
  const row = loadPlace(id);
  if (!row) return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });

  const json = buildClientJson(row.place, getCity(row.place.cityKey)?.name ?? null);
  return new NextResponse(JSON.stringify(json, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="client.json"',
    },
  });
}
