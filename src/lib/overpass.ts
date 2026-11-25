import "server-only";

export const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
export const USER_AGENT =
  process.env.PROSPECTEUR_USER_AGENT ?? "Prospecteur/1.0 (contact@adambellanger.pro)";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Échappe une chaîne pour un littéral Overpass QL entre guillemets doubles. */
function qlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Une seule requête, sorties dans cet ordre :
 *  1. la (ou les) commune(s) trouvée(s), avec leurs tags (plusieurs = homonymes) ;
 *  2. les commerces / artisans / restaurants ;
 *  3. pour chaque polygone de quartier (place=suburb|quarter, admin_level 9/10) : ses tags,
 *     puis les identifiants (sans tags) des commerces qu'il contient ;
 *  4. les nœuds de quartier, en secours (rattachement au plus proche).
 */
export function buildCityQuery(city: string): string {
  const name = qlString(city);
  return `[out:json][timeout:240];
rel["boundary"="administrative"]["admin_level"="8"]["name"="${name}"]->.r;
.r out tags;
.r map_to_area->.a;
(
  nwr["shop"]["name"](area.a);
  nwr["craft"]["name"](area.a);
  nwr["amenity"~"^(restaurant|cafe|bar|hairdresser|beauty)$"]["name"](area.a);
)->.p;
.p out center tags;
(
  rel["place"~"^(suburb|quarter)$"]["name"](area.a);
  rel["boundary"="administrative"]["admin_level"~"^(9|10)$"]["name"](area.a);
)->.q;
foreach.q->.z(
  .z out tags;
  .z map_to_area->.za;
  nwr.p(area.za);
  out ids;
);
node["place"~"^(suburb|quarter|neighbourhood)$"]["name"](area.a);
out body;`;
}

// --- Exclusion mutuelle : un seul appel Overpass à la fois dans le process ---
const g = globalThis as unknown as {
  __overpassChain?: Promise<unknown>;
  __overpassInflight?: Map<string, Promise<OverpassElement[]>>;
};

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__overpassChain ?? Promise.resolve();
  const next = prev.then(fn, fn);
  g.__overpassChain = next.catch(() => undefined);
  return next;
}

export class OverpassError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function postQuery(query: string): Promise<OverpassElement[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(200_000),
    });
    // Serveur surchargé : une seule nouvelle tentative, après une pause.
    if ((res.status === 429 || res.status === 504) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new OverpassError(
        `Overpass a répondu ${res.status}${body ? ` : ${body.slice(0, 200)}` : ""}`,
        res.status,
      );
    }
    const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
    if (json.remark && /error|timed out|runtime/i.test(json.remark)) {
      throw new OverpassError(`Overpass : ${json.remark}`);
    }
    return json.elements ?? [];
  }
}

/**
 * Interroge Overpass pour une ville. Les appels sont sérialisés (un seul à la fois),
 * et deux requêtes simultanées pour la même ville partagent le même appel.
 */
export function fetchCityElements(cityKey: string, city: string): Promise<OverpassElement[]> {
  const inflight = (g.__overpassInflight ??= new Map());
  const existing = inflight.get(cityKey);
  if (existing) return existing;
  const p = runExclusive(() => postQuery(buildCityQuery(city))).finally(() => inflight.delete(cityKey));
  inflight.set(cityKey, p);
  return p;
}
