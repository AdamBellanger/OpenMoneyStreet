import "server-only";
import { and, count, eq, gte, lt, min } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { loginAttempts } = schema;

export const WINDOW_MS = 15 * 60 * 1000;
/** Échecs autorisés par IP sur la fenêtre, puis verrou jusqu'à la fin de la fenêtre. */
export const MAX_PER_IP = 5;
/** Plafond global (toutes IP), contre une attaque distribuée. */
export const MAX_GLOBAL = 30;

/** IP du client : NPM est le seul à pouvoir joindre le container et pose ces en-têtes. */
export function clientIp(headers: Headers): string {
  // X-Real-IP est écrasé par NPM. Pour X-Forwarded-For, seule la DERNIÈRE entrée (ajoutée par
  // le proxy) est fiable : la première est fournie par le client, qui pourrait changer d'IP à
  // chaque tentative pour échapper à la limite.
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  );
}

/** Renvoie le nombre de secondes à attendre si la connexion est bloquée, sinon 0. */
export function retryAfterSeconds(ip: string): number {
  const db = getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const perIp = db
    .select({ n: count(), first: min(loginAttempts.at) })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.at, since)))
    .get();
  const global = db
    .select({ n: count(), first: min(loginAttempts.at) })
    .from(loginAttempts)
    .where(gte(loginAttempts.at, since))
    .get();

  const wait = (first: Date | null | undefined) =>
    first ? Math.max(1, Math.ceil((first.getTime() + WINDOW_MS - Date.now()) / 1000)) : 60;
  if (perIp && perIp.n >= MAX_PER_IP) return wait(perIp.first);
  if (global && global.n >= MAX_GLOBAL) return wait(global.first);
  return 0;
}

export function recordFailure(ip: string): void {
  const db = getDb();
  db.insert(loginAttempts).values({ ip, at: new Date() }).run();
  // Ménage : on ne garde qu'une journée d'historique.
  db.delete(loginAttempts).where(lt(loginAttempts.at, new Date(Date.now() - 24 * 60 * 60 * 1000))).run();
}

export function clearFailures(ip: string): void {
  getDb().delete(loginAttempts).where(eq(loginAttempts.ip, ip)).run();
}
