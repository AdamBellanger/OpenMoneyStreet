import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { CrmStatus, SiteClass } from "../lib/domain";

/**
 * Une ville recherchée. Sert de cache : si `fetchedAt` a moins de 24 h,
 * /api/search relit les commerces depuis SQLite au lieu d'interroger Overpass.
 */
export const cities = sqliteTable("cities", {
  /** Nom normalisé (minuscules, sans espaces superflus) : clé du cache. */
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  placeCount: integer("place_count").notNull().default(0),
  /** Nombre de limites administratives trouvées pour ce nom (>1 = homonymes). */
  areaCount: integer("area_count").notNull().default(1),
});

/** Un commerce / artisan issu d'OpenStreetMap. */
export const places = sqliteTable(
  "places",
  {
    /** Identifiant OSM "node/123", "way/456", "relation/789". */
    id: text("id").primaryKey(),
    cityKey: text("city_key").notNull(),
    name: text("name").notNull(),
    /** Clé OSM principale : shop | craft | amenity. */
    categoryKey: text("category_key").notNull(),
    /** Valeur OSM : bakery, plumber, restaurant… */
    categoryValue: text("category_value").notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    housenumber: text("housenumber"),
    street: text("street"),
    postcode: text("postcode"),
    city: text("city"),
    quartier: text("quartier"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    openingHours: text("opening_hours"),
    /** Tous les tags OSM bruts, pour client.json et le débogage. */
    tags: text("tags", { mode: "json" }).$type<Record<string, string>>().notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("places_city_idx").on(t.cityKey)],
);

/** Dernier résultat de /api/check-site pour un commerce. */
export const siteChecks = sqliteTable("site_checks", {
  placeId: text("place_id").primaryKey(),
  url: text("url"),
  finalUrl: text("final_url"),
  checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
  httpStatus: integer("http_status"),
  reachable: integer("reachable", { mode: "boolean" }).notNull(),
  https: integer("https", { mode: "boolean" }),
  hasViewport: integer("has_viewport", { mode: "boolean" }),
  lastModified: text("last_modified"),
  /** Année de copyright la plus récente trouvée dans la page (indice d'abandon). */
  copyrightYear: integer("copyright_year"),
  classification: text("classification").$type<SiteClass>().notNull(),
  /** Raisons lisibles du classement, séparées par " · ". */
  reasons: text("reasons"),
  error: text("error"),
});

/**
 * Suivi commercial. Table séparée de `places` pour qu'un rafraîchissement
 * Overpass n'écrase jamais les notes ni les statuts.
 */
export const crm = sqliteTable(
  "crm",
  {
    placeId: text("place_id").primaryKey(),
    status: text("status").$type<CrmStatus>().notNull().default("a_contacter"),
    notes: text("notes").notNull().default(""),
    /** Date de relance au format AAAA-MM-JJ. */
    followUp: text("follow_up"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("crm_follow_up_idx").on(t.followUp)],
);

export type CityRow = typeof cities.$inferSelect;
export type PlaceRow = typeof places.$inferSelect;
export type NewPlaceRow = typeof places.$inferInsert;
export type SiteCheckRow = typeof siteChecks.$inferSelect;
export type CrmRow = typeof crm.$inferSelect;

/** Tentatives de connexion échouées, pour la limite anti-force brute (survit aux redémarrages). */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("login_attempts_ip_at_idx").on(t.ip, t.at), index("login_attempts_at_idx").on(t.at)],
);
