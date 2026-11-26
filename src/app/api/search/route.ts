import { NextResponse, type NextRequest } from "next/server";
import { normalizeCityKey, type SearchResponse } from "@/lib/domain";
import { fetchCityElements, OverpassError } from "@/lib/overpass";
import { getCity, loadCityPlaces, parseElements, saveCity } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/search?city=Rouen[&refresh=1]
 * Renvoie les commerces de la ville. Overpass n'est interrogé que si le cache a plus de 24 h
 * (ou si refresh=1).
 */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  // Lettres, espaces, tirets, apostrophes et points seulement (Saint-Étienne, L'Haÿ-les-Roses…) :
  // rien d'autre n'a à entrer dans la requête Overpass.
  if (!city || city.length > 100 || !/^[\p{L}\p{M}][\p{L}\p{M}\p{N} '’.\-]*$/u.test(city)) {
    return NextResponse.json({ error: "Paramètre city manquant ou invalide" }, { status: 400 });
  }
  const cityKey = normalizeCityKey(city);

  let cached = getCity(cityKey);
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  let fromCache = true;

  if (!fresh || refresh) {
    try {
      const elements = await fetchCityElements(cityKey, city);
      const parsed = parseElements(cityKey, elements);
      if (parsed.areaCount === 0) {
        return NextResponse.json(
          { error: `Aucune commune nommée « ${city} » trouvée dans OSM (vérifiez l'orthographe et les accents).` },
          { status: 404 },
        );
      }
      saveCity(cityKey, city, parsed);
      cached = getCity(cityKey);
      fromCache = false;
    } catch (e) {
      // Overpass indisponible : on sert le cache périmé s'il existe.
      if (!cached) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = e instanceof OverpassError && e.status === 429 ? 429 : 502;
        return NextResponse.json({ error: `Échec de la requête Overpass : ${msg}` }, { status });
      }
    }
  }

  const body: SearchResponse = {
    city: cached!.name,
    cityKey,
    fetchedAt: cached!.fetchedAt.getTime(),
    fromCache,
    areaCount: cached!.areaCount,
    places: loadCityPlaces(cityKey),
  };
  return NextResponse.json(body);
}
