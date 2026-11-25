import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

// En dev, Next recharge les modules : on garde une seule connexion par process.
const g = globalThis as unknown as { __prospecteurDb?: Db };

function createDb(): Db {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "prospecteur.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  // Arrêt du container (SIGTERM -> process.exit) : fermer la connexion fait un checkpoint
  // et supprime le WAL, la base reste un fichier unique et cohérent.
  process.once("exit", () => {
    if (sqlite.open) sqlite.close();
  });
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

/** Connexion paresseuse : rien n'est ouvert tant qu'une route n'en a pas besoin. */
export function getDb(): Db {
  return (g.__prospecteurDb ??= createDb());
}

export { schema };
