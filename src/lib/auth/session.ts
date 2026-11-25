import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Session sans état : cookie signé HMAC-SHA256 contenant {sub, exp}.
 * Un seul utilisateur, donc rien à stocker côté serveur ; changer SESSION_SECRET
 * déconnecte toutes les sessions.
 */
export const SESSION_COOKIE = "prospecteur_session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  exp: number; // secondes epoch
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(sub: string): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  const payload: SessionPayload = { sub, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

/** Renvoie l'utilisateur si le jeton est valide et non expiré, sinon null. */
export function verifySessionToken(token: string | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(data, key));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (payload.sub !== process.env.AUTH_USERNAME) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_S) {
  return {
    httpOnly: true,
    // En dev on reste sur http://localhost ; en prod NPM sert tout en HTTPS.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
