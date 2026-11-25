"use client";

import {
  CRM_STATUSES,
  CRM_STATUS_LABELS,
  SITE_CLASS_LABELS,
  type PlaceDTO,
  type SiteDisplayClass,
} from "@/lib/domain";
import { EMPTY_FILTERS, type Filters } from "./useProspectTable";

const SELECT =
  "h-9 max-w-[11rem] truncate rounded-full border border-foreground/15 bg-anthracite px-3 text-xs text-foreground outline-none transition-colors duration-150 hover:border-foreground/30 focus:border-accent";

const SITE_ORDER: SiteDisplayClass[] = ["pas_de_site", "site_casse", "site_obsolete", "non_verifie", "site_ok"];

function uniqueSorted(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "fr"));
}

export function Toolbar({
  places,
  filters,
  onChange,
  shown,
  actions,
}: {
  places: PlaceDTO[];
  filters: Filters;
  onChange: (f: Filters) => void;
  shown: number;
  actions: React.ReactNode;
}) {
  const categories = uniqueSorted(places.map((p) => p.category));
  const quartiers = uniqueSorted(places.map((p) => p.quartier));
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [k]: e.target.value });
  const active = Object.values(filters).some((v) => v !== "");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 px-6 py-3 sm:px-10">
      <input
        type="search"
        value={filters.q}
        onChange={set("q")}
        placeholder="Rechercher un nom, une adresse…"
        aria-label="Recherche texte"
        className="h-9 w-56 rounded-full border border-foreground/15 bg-background px-4 text-xs outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
      />
      <select aria-label="Catégorie" value={filters.category} onChange={set("category")} className={SELECT}>
        <option value="">Toutes catégories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select aria-label="Classement du site" value={filters.siteClass} onChange={set("siteClass")} className={SELECT}>
        <option value="">Tous les sites</option>
        {SITE_ORDER.map((s) => (
          <option key={s} value={s}>
            {SITE_CLASS_LABELS[s]}
          </option>
        ))}
      </select>
      <select aria-label="Statut" value={filters.crm} onChange={set("crm")} className={SELECT}>
        <option value="">Tous statuts</option>
        {CRM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CRM_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select aria-label="Quartier" value={filters.quartier} onChange={set("quartier")} className={SELECT}>
        <option value="">Tous quartiers</option>
        {quartiers.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs text-muted transition-colors duration-150 hover:text-foreground"
        >
          Réinitialiser
        </button>
      )}
      <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-muted">
        {shown} / {places.length}
      </span>
      {actions}
    </div>
  );
}
