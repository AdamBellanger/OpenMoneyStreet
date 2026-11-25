import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { clearFailures, clientIp, recordFailure, retryAfterSeconds } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Durée minimale d'une réponse en échec, pour ne rien révéler par le temps de réponse. */
const MIN_FAILURE_MS = 800;
// Hash factice : bcrypt tourne même si l'identifiant est faux (temps de réponse identique).
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("prospecteur-dummy", 12));

function configuredHash(): string | null {
  const b64 = process.env.AUTH_PASSWORD_HASH_B64?.trim();
  if (!b64) return null;
  const hash = Buffer.from(b64, "base64").toString("utf8").trim();
  return /^\$2[aby]\$\d{2}\$/.test(hash) ? hash : null;
}

function sameString(a: string, b: string): boolean {
  // Comparaison en temps constant sur des empreintes de même longueur.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIp(req.headers);

  const wait = retryAfterSeconds(ip);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const username = process.env.AUTH_USERNAME;
  const hash = configuredHash();
  if (!username || !hash || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.error("[auth] AUTH_USERNAME, AUTH_PASSWORD_HASH_B64 ou SESSION_SECRET manquant/invalide");
    return NextResponse.json({ error: "Authentification non configurée sur le serveur." }, { status: 500 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const givenUser = typeof body.username === "string" ? body.username.slice(0, 200) : "";
  const givenPass = typeof body.password === "string" ? body.password.slice(0, 200) : "";

  const userOk = sameString(givenUser, username);
  const passOk = await bcrypt.compare(givenPass, userOk ? hash : getDummyHash());

  if (!userOk || !passOk) {
    recordFailure(ip);
    const elapsed = Date.now() - started;
    if (elapsed < MIN_FAILURE_MS) await new Promise((r) => setTimeout(r, MIN_FAILURE_MS - elapsed));
    return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }

  clearFailures(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions());
  return res;
}
