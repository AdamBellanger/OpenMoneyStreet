import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Devant chaque requête (pages ET /api) :
 * 1. Seuls /login, /api/auth/login et /api/health sont publics.
 * 2. Sans session valide : une page redirige vers /login?next=…, une API renvoie 401.
 * 3. Les requêtes API qui modifient des données doivent venir de la même origine.
 * 4. Chaque page reçoit une Content-Security-Policy à nonce (même schéma que Portfolio2026).
 */

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/health"]);

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Leaflet et Framer Motion écrivent des styles inline.
    "style-src 'self' 'unsafe-inline'",
    // Tuiles OSM + vignettes Panoramax (servies par plusieurs instances, d'où https:).
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const user = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (isApi && request.method !== "GET" && request.method !== "HEAD" && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  }

  if (!PUBLIC_PATHS.has(pathname) && !user) {
    if (isApi) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url, 307);
  }

  // Déjà connecté : la page de connexion renvoie vers l'outil.
  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  if (isApi) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Next.js lit le nonce dans l'en-tête CSP de la requête pendant le rendu.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Tout, sauf les fichiers statiques de Next, les polices et l'icône.
  matcher: ["/((?!_next/static|_next/image|fonts/|icon\\.svg|favicon\\.ico).*)"],
};
