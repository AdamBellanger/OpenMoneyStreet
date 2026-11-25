import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { isValidPlaceId } from "@/lib/domain";
import { loadPlace, toPlaceDTO } from "@/lib/places";
import { checkSite } from "@/lib/site-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/check-site  { id: "node/123" }
 * Vérifie le site du commerce (timeout 8 s), enregistre le résultat et renvoie la fiche à jour.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!isValidPlaceId(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const row = loadPlace(id);
  if (!row) return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });

  const now = new Date();
  const values = row.place.website
    ? await checkSite(row.place.website).then((r) => ({
        placeId: id,
        url: r.url,
        finalUrl: r.finalUrl,
        checkedAt: now,
        httpStatus: r.httpStatus,
        reachable: r.reachable,
        https: r.https,
        hasViewport: r.hasViewport,
        lastModified: r.lastModified,
        copyrightYear: r.copyrightYear,
        classification: r.classification,
        reasons: r.reasons.join(" · "),
        error: r.error,
      }))
    : {
        placeId: id,
        url: null,
        finalUrl: null,
        checkedAt: now,
        httpStatus: null,
        reachable: false,
        https: null,
        hasViewport: null,
        lastModified: null,
        copyrightYear: null,
        classification: "pas_de_site" as const,
        reasons: "aucun tag website dans OSM",
        error: null,
      };

  getDb()
    .insert(schema.siteChecks)
    .values(values)
    .onConflictDoUpdate({ target: schema.siteChecks.placeId, set: values })
    .run();

  const updated = loadPlace(id)!;
  return NextResponse.json(toPlaceDTO(updated.place, updated.check, updated.crm));
}
