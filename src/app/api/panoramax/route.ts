import { NextResponse, type NextRequest } from "next/server";
import { USER_AGENT } from "@/lib/overpass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.panoramax.xyz/api/search";
const TTL_MS = 24 * 60 * 60 * 1000;

interface Feature {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { datetime?: string };
  assets: Record<string, { href: string }>;
  links?: { rel: string; href: string }[];
}

// Cache mémoire : une même fiche rouverte ne relance pas d'appel.
const g = globalThis as unknown as { __panoramaxCache?: Map<string, { at: number; body: unknown }> };
const cache = (g.__panoramaxCache ??= new Map());

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * GET /api/panoramax?lat=…&lon=…
 * Photo Panoramax la plus proche qui regarde le commerce (place_position), à 50 m maximum.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat/lon invalides" }, { status: 400 });
  }
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  const url = `${API}?place_position=${lon},${lat}&place_distance=0-50&limit=10`;
  let features: Feature[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Panoramax a répondu ${res.status}`);
    features = ((await res.json()) as { features?: Feature[] }).features ?? [];
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Panoramax injoignable" }, { status: 502 });
  }

  const best = features
    .map((f) => ({ f, d: distanceM(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
    .sort((a, b) => a.d - b.d)[0];

  const body = {
    photo: best
      ? {
          id: best.f.id,
          thumb: best.f.assets.sd?.href ?? best.f.assets.thumb?.href,
          hd: best.f.assets.hd?.href ?? null,
          date: best.f.properties.datetime ?? null,
          distance: best.d,
          licence: best.f.links?.find((l) => l.rel === "license")?.href ?? null,
          viewerUrl: `https://api.panoramax.xyz/#focus=pic&pic=${best.f.id}`,
        }
      : null,
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return NextResponse.json(body);
}
