import "server-only";
import { lookup } from "node:dns/promises";
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

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Refuse les adresses internes (garde SSRF) : à vérifier à chaque saut de redirection. */
async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`protocole ${url.protocol} refusé`);
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) throw new Error(`port ${url.port} refusé`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("hôte interne refusé");
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("adresse IP privée refusée");
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/** Suit les redirections à la main pour contrôler chaque destination. */
async function fetchFollowing(start: URL, signal: AbortSignal): Promise<{ res: Response; url: URL }> {
  let url = start;
  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new Error("trop de redirections");
      await res.body?.cancel().catch(() => undefined);
      url = new URL(location, url);
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
      const html = (res.headers.get("content-type") ?? "").includes("html") || res.ok ? await readCapped(res) : "";
      const result: SiteCheckResult = {
        ...base,
        finalUrl: url.href,
        httpStatus: res.status,
        reachable: true,
        https: url.protocol === "https:",
        hasViewport: /<meta[^>]+name\s*=\s*["']?viewport/i.test(html),
        lastModified: res.headers.get("last-modified"),
        copyrightYear: latestCopyrightYear(html),
      };
      return classify(result);
    } catch (e) {
      lastError = e instanceof Error ? (e.name === "TimeoutError" ? "délai de 8 s dépassé" : e.message) : String(e);
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
