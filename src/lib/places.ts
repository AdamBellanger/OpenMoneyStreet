import "server-only";
import { and, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CrmRow, NewPlaceRow, PlaceRow, SiteCheckRow } from "@/db/schema";
import {
  categoryLabel,
  CLOSED_STATUSES,
  type PlaceDTO,
  type SiteCheckDTO,
  type SiteDisplayClass,
} from "./domain";
import type { OverpassElement } from "./overpass";

const { cities, places, siteChecks, crm } = schema;

const AMENITIES = new Set(["restaurant", "cafe", "bar", "hairdresser", "beauty"]);
/** Valeurs qui désignent un local vide ou fermé : pas des prospects. */
const SKIP_VALUES = new Set(["vacant", "no", "disused", "closed"]);

function pickCategory(tags: Record<string, string>): { key: string; value: string } | null {
  if (tags.shop && !SKIP_VALUES.has(tags.shop)) return { key: "shop", value: tags.shop };
  if (tags.craft && !SKIP_VALUES.has(tags.craft)) return { key: "craft", value: tags.craft };
  if (tags.amenity && AMENITIES.has(tags.amenity)) return { key: "amenity", value: tags.amenity };
  return null;
}

function first(tags: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = tags[k]?.trim();
    if (v) return v;
  }
  return null;
}

interface QuartierPoint {
  name: string;
  lat: number;
  lon: number;
}

/** Distance approchée en mètres (projection équirectangulaire, suffisante à l'échelle d'une ville). */
function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const x = ((bLon - aLon) * Math.PI) / 180 * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const y = ((bLat - aLat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

function nearestQuartier(points: QuartierPoint[], lat: number, lon: number): string | null {
  let best: QuartierPoint | null = null;
  let bestD = 2_500; // au-delà, on préfère ne rien affirmer
  for (const p of points) {
    const d = distanceM(lat, lon, p.lat, p.lon);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best?.name ?? null;
}

/** Priorité d'un découpage en quartiers (plus petit = préféré), null si ce n'en est pas un. */
function polygonRank(tags: Record<string, string>): number | null {
  if (tags.place === "suburb") return 0;
  if (tags.place === "quarter") return 1;
  if (tags.boundary === "administrative" && tags.admin_level === "10") return 2;
  if (tags.boundary === "administrative" && tags.admin_level === "9") return 3;
  return null;
}

/** "Quartier de la Grand'Mare" -> "Grand'Mare". */
function cleanQuartierName(name: string): string {
  return name.replace(/^quartier\s+(?:(?:de la|du|des)\s+|de l'|d')?/i, "").trim() || name;
}

export interface ParsedCity {
  areaCount: number;
  rows: NewPlaceRow[];
}

/** Transforme la réponse Overpass en lignes `places`. */
export function parseElements(cityKey: string, elements: OverpassElement[]): ParsedCity {
  let areaCount = 0;
  const quartierNodes: Record<string, QuartierPoint[]> = { suburb: [], quarter: [], neighbourhood: [] };
  const candidates: OverpassElement[] = [];
  /** Quartier (polygone) de chaque commerce, avec la priorité du découpage qui l'a donné. */
  const inPolygon = new Map<string, { name: string; rank: number }>();
  let polygon: { name: string; rank: number } | null = null;

  for (const el of elements) {
    const tags = el.tags;
    if (!tags) {
      // Sortie `out ids` du foreach : commerce contenu dans le polygone courant.
      if (polygon) {
        const id = `${el.type}/${el.id}`;
        const prev = inPolygon.get(id);
        if (!prev || polygon.rank < prev.rank) inPolygon.set(id, polygon);
      }
      continue;
    }
    if (el.type === "relation" && !pickCategory(tags)) {
      const rank = polygonRank(tags);
      if (tags.boundary === "administrative" && tags.admin_level === "8") areaCount++;
      else if (rank !== null && tags.name) polygon = { name: cleanQuartierName(tags.name), rank };
      continue;
    }
    if (el.type === "node" && tags.place && quartierNodes[tags.place] && !pickCategory(tags)) {
      if (el.lat != null && el.lon != null) quartierNodes[tags.place].push({ name: tags.name, lat: el.lat, lon: el.lon });
      continue;
    }
    candidates.push(el);
  }

  // Les "neighbourhood" sont très fins : on ne les utilise que si la ville n'a pas de quartiers plus larges.
  const coarse = [...quartierNodes.suburb, ...quartierNodes.quarter];
  // Si la ville a de vrais polygones de quartier, on ne mélange pas avec les nœuds (autre découpage).
  const quartierPoints =
    inPolygon.size > 0 ? [] : coarse.length >= 3 ? coarse : [...coarse, ...quartierNodes.neighbourhood];

  const now = new Date();
  const seen = new Set<string>();
  const rows: NewPlaceRow[] = [];
  for (const el of candidates) {
    const tags = el.tags!;
    const cat = pickCategory(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!cat || !tags.name || lat == null || lon == null) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    rows.push({
      id,
      cityKey,
      name: tags.name,
      categoryKey: cat.key,
      categoryValue: cat.value,
      lat,
      lon,
      housenumber: first(tags, "addr:housenumber"),
      street: first(tags, "addr:street", "addr:place"),
      postcode: first(tags, "addr:postcode"),
      city: first(tags, "addr:city"),
      quartier:
        first(tags, "addr:suburb", "addr:quarter") ??
        inPolygon.get(id)?.name ??
        nearestQuartier(quartierPoints, lat, lon),
      phone: first(tags, "phone", "contact:phone", "mobile", "contact:mobile"),
      email: first(tags, "email", "contact:email"),
      website: first(tags, "website", "contact:website", "url"),
      openingHours: first(tags, "opening_hours"),
      tags,
      updatedAt: now,
    });
  }
  return { areaCount, rows };
}

/** Enregistre le résultat d'une recherche. Les fiches CRM et les vérifications existantes sont conservées. */
export function saveCity(cityKey: string, cityName: string, parsed: ParsedCity): void {
  const db = getDb();
  db.transaction((tx) => {
    const now = new Date();
    tx.insert(cities)
      .values({ key: cityKey, name: cityName, fetchedAt: now, placeCount: parsed.rows.length, areaCount: parsed.areaCount })
      .onConflictDoUpdate({
        target: cities.key,
        set: { name: cityName, fetchedAt: now, placeCount: parsed.rows.length, areaCount: parsed.areaCount },
      })
      .run();

    for (let i = 0; i < parsed.rows.length; i += 500) {
      tx.insert(places)
        .values(parsed.rows.slice(i, i + 500))
        .onConflictDoUpdate({
          target: places.id,
          set: {
            cityKey: sql`excluded.city_key`,
            name: sql`excluded.name`,
            categoryKey: sql`excluded.category_key`,
            categoryValue: sql`excluded.category_value`,
            lat: sql`excluded.lat`,
            lon: sql`excluded.lon`,
            housenumber: sql`excluded.housenumber`,
            street: sql`excluded.street`,
            postcode: sql`excluded.postcode`,
            city: sql`excluded.city`,
            quartier: sql`excluded.quartier`,
            phone: sql`excluded.phone`,
            email: sql`excluded.email`,
            website: sql`excluded.website`,
            openingHours: sql`excluded.opening_hours`,
            tags: sql`excluded.tags`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .run();
    }

    // Commerces disparus d'OSM : on les supprime, sauf s'ils ont déjà une fiche CRM.
    const keep = new Set(parsed.rows.map((r) => r.id));
    for (const r of tx.select({ id: crm.placeId }).from(crm).all()) keep.add(r.id);
    const stale = tx
      .select({ id: places.id })
      .from(places)
      .where(eq(places.cityKey, cityKey))
      .all()
      .map((r) => r.id)
      .filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += 500) {
      const chunk = stale.slice(i, i + 500);
      tx.delete(siteChecks).where(inArray(siteChecks.placeId, chunk)).run();
      tx.delete(places).where(inArray(places.id, chunk)).run();
    }
  });
}

export function getCity(cityKey: string) {
  return getDb().select().from(cities).where(eq(cities.key, cityKey)).get();
}

export function formatAddress(p: Pick<PlaceRow, "housenumber" | "street" | "postcode" | "city">): string {
  const line1 = [p.housenumber, p.street].filter(Boolean).join(" ");
  const line2 = [p.postcode, p.city].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

export function siteCheckToDTO(c: SiteCheckRow): SiteCheckDTO {
  return {
    classification: c.classification,
    checkedAt: c.checkedAt.getTime(),
    url: c.url,
    finalUrl: c.finalUrl,
    httpStatus: c.httpStatus,
    reachable: c.reachable,
    https: c.https,
    hasViewport: c.hasViewport,
    lastModified: c.lastModified,
    copyrightYear: c.copyrightYear,
    reasons: c.reasons,
    error: c.error,
  };
}

export function toPlaceDTO(p: PlaceRow, check: SiteCheckRow | null, c: CrmRow | null): PlaceDTO {
  const siteClass: SiteDisplayClass = !p.website ? "pas_de_site" : (check?.classification ?? "non_verifie");
  return {
    id: p.id,
    name: p.name,
    categoryKey: p.categoryKey,
    categoryValue: p.categoryValue,
    category: categoryLabel(p.categoryKey, p.categoryValue),
    lat: p.lat,
    lon: p.lon,
    address: formatAddress(p),
    quartier: p.quartier,
    phone: p.phone,
    email: p.email,
    website: p.website,
    openingHours: p.openingHours,
    siteClass,
    site: check ? siteCheckToDTO(check) : null,
    crm: {
      status: c?.status ?? "a_contacter",
      notes: c?.notes ?? "",
      followUp: c?.followUp ?? null,
      amount: c?.amount ?? null,
      monthly: c?.monthly ?? null,
      signedOn: c?.signedOn ?? null,
      updatedAt: c?.updatedAt.getTime() ?? null,
    },
  };
}

export function loadCityPlaces(cityKey: string): PlaceDTO[] {
  const rows = getDb()
    .select({ place: places, check: siteChecks, crm })
    .from(places)
    .leftJoin(siteChecks, eq(siteChecks.placeId, places.id))
    .leftJoin(crm, eq(crm.placeId, places.id))
    .where(eq(places.cityKey, cityKey))
    .orderBy(places.name)
    .all();
  return rows.map((r) => toPlaceDTO(r.place, r.check, r.crm));
}

export function loadPlace(id: string) {
  const r = getDb()
    .select({ place: places, check: siteChecks, crm })
    .from(places)
    .leftJoin(siteChecks, eq(siteChecks.placeId, places.id))
    .leftJoin(crm, eq(crm.placeId, places.id))
    .where(eq(places.id, id))
    .get();
  return r ?? null;
}

/** Relances dues à `date` (incluse) ou en retard, hors fiches signées ou refusées. */
export function loadFollowUps(date: string) {
  const rows = getDb()
    .select({ place: places, check: siteChecks, crm, cityName: cities.name })
    .from(crm)
    .innerJoin(places, eq(places.id, crm.placeId))
    .leftJoin(siteChecks, eq(siteChecks.placeId, places.id))
    .leftJoin(cities, eq(cities.key, places.cityKey))
    .where(and(lte(crm.followUp, date), notInArray(crm.status, CLOSED_STATUSES)))
    .orderBy(crm.followUp, places.name)
    .all();
  return rows.map((r) => ({ ...toPlaceDTO(r.place, r.check, r.crm), cityName: r.cityName ?? "" }));
}
