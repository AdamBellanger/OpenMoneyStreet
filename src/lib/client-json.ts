import "server-only";
import type { PlaceRow } from "@/db/schema";
import { categoryLabel } from "./domain";
import { formatAddress } from "./places";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
type DayName = (typeof DAY_NAMES)[number];

/**
 * Analyse simple du tag opening_hours (les formes courantes : "Mo-Fr 09:00-12:00,14:00-19:00; Sa 09:00-12:00; Su off",
 * "24/7"). Renvoie null si une règle est trop complexe (jours fériés, mois, semaines…) :
 * le générateur doit alors se contenter de `osm`, toujours fourni tel quel.
 */
export function parseOpeningHours(raw: string | null): Record<DayName, string[]> | null {
  if (!raw) return null;
  const week = Object.fromEntries(DAY_NAMES.map((d) => [d, [] as string[]])) as Record<DayName, string[]>;
  const value = raw.trim();
  if (value === "24/7") {
    for (const d of DAY_NAMES) week[d] = ["00:00-24:00"];
    return week;
  }

  for (const rule of value.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
    if (!m) return null;
    const days = new Set<number>();
    for (const part of m[1].split(",").map((p) => p.trim())) {
      const [from, to] = part.split("-").map((p) => DAYS.indexOf(p.trim() as (typeof DAYS)[number]));
      if (from < 0 || (to !== undefined && to < 0)) return null;
      if (to === undefined) days.add(from);
      else for (let i = from; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === to) break;
      }
    }
    const times = m[2].trim();
    const slots =
      times === "off" || times === "closed"
        ? []
        : times.split(",").map((t) => t.trim().replace(/\s+/g, ""));
    if (slots.some((s) => !/^\d{2}:\d{2}-\d{2}:\d{2}\+?$/.test(s))) return null;
    // Une règle plus tardive remplace la précédente pour les mêmes jours (sémantique OSM).
    for (const d of days) week[DAY_NAMES[d]] = slots;
  }
  return week;
}

const EXTRA_TAGS = [
  "cuisine",
  "description",
  "brand",
  "operator",
  "wheelchair",
  "takeaway",
  "delivery",
  "outdoor_seating",
  "diet:vegetarian",
  "diet:vegan",
  "payment:cards",
  "facebook",
  "contact:facebook",
  "instagram",
  "contact:instagram",
  "level",
];

/** Données pré-remplies pour le générateur de sites vitrines. */
export function buildClientJson(p: PlaceRow, cityName: string | null) {
  const tags = p.tags ?? {};
  const extras = Object.fromEntries(EXTRA_TAGS.filter((k) => tags[k]).map((k) => [k, tags[k]]));
  return {
    $schema: "prospecteur/client.json@1",
    source: {
      osmId: p.id,
      osmUrl: `https://www.openstreetmap.org/${p.id}`,
      generatedAt: new Date().toISOString(),
      licence: "© contributeurs OpenStreetMap, ODbL",
    },
    nom: p.name,
    categorie: {
      label: categoryLabel(p.categoryKey, p.categoryValue),
      osm: `${p.categoryKey}=${p.categoryValue}`,
    },
    adresse: {
      numero: p.housenumber,
      rue: p.street,
      codePostal: p.postcode,
      ville: p.city ?? cityName,
      quartier: p.quartier,
      complete: formatAddress({ ...p, city: p.city ?? cityName }),
    },
    coordonnees: { lat: p.lat, lon: p.lon },
    contact: {
      telephone: p.phone,
      email: p.email,
      siteActuel: p.website,
    },
    horaires: {
      osm: p.openingHours,
      semaine: parseOpeningHours(p.openingHours),
    },
    extras,
  };
}
