import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { SiteClass } from "./domain";
import { USER_AGENT } from "./overpass";

const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 512 * 1024;
/** Au-delà, un site est considéré comme obsolète (Last-Modified ou année de ©). */
const STALE_YEARS = 4;

/** Une page de réseau social ou d'annuaire n'est pas un site : c'est un prospect. */
const NOT_A_WEBSITE =
  /(^|\.)(facebook\.com|fb\.com|instagram\.com|linktr\.ee|tiktok\.com|pagesjaunes\.fr|tripadvisor\.[a-z.]+|google\.com|business\.site|g\.page|linkedin\.com|twitter\.com|x\.com|planity\.com|thefork\.[a-z]+)$/i;

export interface SiteCheckResult {
  url: string;
  finalUrl: string | null;
  httpStatus: number | null;
  reachable: boolean;
  https: boolean | null;
  hasViewport: boolean | null;
  lastModified: string | null;
  copyrightYear: number | null;
  classification: SiteClass;
  reasons: string[];
  error: string | null;
}

/** Plages jamais joignables depuis la vérification de sites (réseaux internes, réservés, multicast). */
const BLOCKED = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 127], // :: et ::1
  ["fc00::", 7], // ULA
  ["fe80::", 10], // lien local
  ["ff00::", 8], // multicast
  ["64:ff9b::", 96], // NAT64 : peut pointer vers une IPv4 interne
  ["2002::", 16], // 6to4 : idem
  ["2001:db8::", 32], // documentation
] as const) {
  BLOCKED.addSubnet(addr, prefix, "ipv6");
}

function isBlockedIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return BLOCKED.check(mapped[1], "ipv4");
  if (net.isIPv4(ip)) return BLOCKED.check(ip, "ipv4");
  if (net.isIPv6(ip)) return BLOCKED.check(ip, "ipv6");
  return true;
}

/**
 * Résolution DNS utilisée PAR la connexion elle-même : l'adresse contrôlée est exactement
 * celle à laquelle on se connecte. Un contrôle fait avant `fetch` laissait une fenêtre de
 * DNS rebinding (le domaine répond une IP publique au contrôle, 127.0.0.1 à la connexion).
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as unknown as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedIp(a.address))) {
      return callback(new Error("adresse IP privée refusée"), "", 4);
    }
    if (options.all) (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    else callback(null, list[0].address, list[0].family);
  });
};

/** Contrôles statiques de l'URL (le contrôle d'IP, lui, a lieu à la connexion). */
function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`protocole ${url.protocol} refusé`);
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) throw new Error(`port ${url.port} refusé`);
  if (url.username || url.password) throw new Error("identifiants dans l'URL refusés");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("hôte interne refusé");
  }
  // IP écrite en dur : Node ne passe pas par `lookup`, on la contrôle ici.
  if (net.isIP(host) && isBlockedIp(host)) throw new Error("adresse IP privée refusée");
}

interface RawResponse {
  status: number;
  location: string | null;
  lastModified: string | null;
  body: string;
}

function requestOnce(url: URL, signal: AbortSignal): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const header = (name: string) => {
          const v = res.headers[name];
          return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
        };
        const base = { status, location: header("location"), lastModified: header("last-modified") };
        const isHtml = String(res.headers["content-type"] ?? "").includes("html");
        if ((status >= 300 && status < 400) || !isHtml) {
          res.resume();
          resolve({ ...base, body: "" });
          return;
        }
        // Lecture plafonnée : une page énorme n'occupe pas la mémoire.
        const chunks: Buffer[] = [];
        let total = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({ ...base, body: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8") });
        };
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          total += chunk.length;
          if (total >= MAX_BYTES) {
            finish();
            res.destroy();
          }
        });
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", (e) => (settled ? undefined : reject(e)));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Suit les redirections à la main pour contrôler chaque destination. */
async function fetchFollowing(start: URL, signal: AbortSignal): Promise<{ res: RawResponse; url: URL }> {
  let url = start;
  for (let hop = 0; ; hop++) {
    assertAllowedUrl(url);
    const res = await requestOnce(url, signal);
    if (res.status >= 300 && res.status < 400 && res.location) {
      if (hop >= MAX_REDIRECTS) throw new Error("trop de redirections");
      url = new URL(res.location, url);
      continue;
    }
    return { res, url };
  }
}

function latestCopyrightYear(html: string): number | null {
  const now = new Date().getFullYear();
  let best: number | null = null;
  const re = /(?:©|&copy;|&#169;|copyright)\s*(?:\d{4}\s*(?:-|–|&ndash;)\s*)?((?:19|20)\d{2})/gi;
  for (const m of html.matchAll(re)) {
    const y = Number(m[1]);
    if (y >= 1995 && y <= now + 1 && (best === null || y > best)) best = y;
  }
  return best;
}

function candidates(raw: string): URL[] {
  const trimmed = raw.trim().split(/\s*;\s*/)[0];
  if (/^https?:\/\//i.test(trimmed)) return [new URL(trimmed)];
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) throw new Error("protocole refusé");
  // Pas de schéma dans le tag OSM : on tente HTTPS puis HTTP.
  return [new URL(`https://${trimmed}`), new URL(`http://${trimmed}`)];
}

export async function checkSite(rawUrl: string): Promise<SiteCheckResult> {
  const base: SiteCheckResult = {
    url: rawUrl,
    finalUrl: null,
    httpStatus: null,
    reachable: false,
    https: null,
    hasViewport: null,
    lastModified: null,
    copyrightYear: null,
    classification: "site_casse",
    reasons: [],
    error: null,
  };

  let urls: URL[];
  try {
    urls = candidates(rawUrl);
  } catch (e) {
    const msg = e instanceof Error && e.message === "protocole refusé" ? "protocole refusé" : "URL invalide";
    return { ...base, reasons: [`${msg} dans OSM`], error: msg };
  }

  if (NOT_A_WEBSITE.test(urls[0].hostname)) {
    return {
      ...base,
      finalUrl: urls[0].href,
      classification: "pas_de_site",
      reasons: [`page ${urls[0].hostname.replace(/^www\./, "")} uniquement, pas de vrai site`],
    };
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let lastError = "injoignable";
  for (const start of urls) {
    try {
      const { res, url } = await fetchFollowing(start, signal);
      const html = res.body;
      const result: SiteCheckResult = {
        ...base,
        finalUrl: url.href,
        httpStatus: res.status,
        reachable: true,
        https: url.protocol === "https:",
        hasViewport: /<meta[^>]+name\s*=\s*["']?viewport/i.test(html),
        lastModified: res.lastModified,
        copyrightYear: latestCopyrightYear(html),
      };
      return classify(result);
    } catch (e) {
      lastError = e instanceof Error ? (e.name === "TimeoutError" || e.name === "AbortError" ? "délai de 8 s dépassé" : e.message) : String(e);
      if (signal.aborted) break;
      // Erreur TLS sur https:// sans schéma d'origine : on retente en http://.
    }
  }
  return { ...base, reasons: [lastError], error: lastError };
}

function classify(r: SiteCheckResult): SiteCheckResult {
  const reasons: string[] = [];
  if (r.httpStatus !== null && r.httpStatus >= 400) {
    return { ...r, classification: "site_casse", reasons: [`HTTP ${r.httpStatus}`] };
  }
  const limit = new Date().getFullYear() - STALE_YEARS;
  if (!r.https) reasons.push("pas de HTTPS");
  if (!r.hasViewport) reasons.push("pas responsive (meta viewport absente)");
  if (r.lastModified) {
    const d = new Date(r.lastModified);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() < limit) reasons.push(`Last-Modified ${d.getFullYear()}`);
  }
  if (r.copyrightYear !== null && r.copyrightYear < limit) reasons.push(`© ${r.copyrightYear}`);
  if (reasons.length > 0) return { ...r, classification: "site_obsolete", reasons };
  return { ...r, classification: "site_ok", reasons: ["HTTPS, responsive, récent"] };
}
