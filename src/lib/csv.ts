import { CRM_STATUS_LABELS, SITE_CLASS_LABELS, type PlaceDTO } from "./domain";

const COLUMNS: [string, (p: PlaceDTO) => string | number | null][] = [
  ["Nom", (p) => p.name],
  ["Catégorie", (p) => p.category],
  ["Adresse", (p) => p.address],
  ["Quartier", (p) => p.quartier],
  ["Téléphone", (p) => p.phone],
  ["Email", (p) => p.email],
  ["Site", (p) => p.website],
  ["Classement", (p) => SITE_CLASS_LABELS[p.siteClass]],
  ["Raisons", (p) => p.site?.reasons ?? null],
  ["Statut", (p) => CRM_STATUS_LABELS[p.crm.status]],
  ["Relance", (p) => p.crm.followUp],
  ["Notes", (p) => p.crm.notes],
  ["Horaires", (p) => p.openingHours],
  ["Latitude", (p) => p.lat],
  ["Longitude", (p) => p.lon],
  ["OSM", (p) => `https://www.openstreetmap.org/${p.id}`],
];

function cell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Empêche l'injection de formules à l'ouverture dans un tableur.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV au format Excel français : séparateur ";", BOM UTF-8. */
export function placesToCsv(places: PlaceDTO[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(";")];
  for (const p of places) lines.push(COLUMNS.map(([, get]) => cell(get(p))).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function downloadText(content: string, filename: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
