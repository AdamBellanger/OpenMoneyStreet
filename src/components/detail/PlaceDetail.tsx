"use client";

import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { checkSite, clientJsonUrl, fetchPanoramax, updateCrm } from "@/lib/api-client";
import {
  CRM_STATUSES,
  CRM_STATUS_COLORS,
  CRM_STATUS_LABELS,
  type CrmStatus,
  type PlaceDTO,
} from "@/lib/domain";
import { MoneyInput } from "@/components/dashboard/Clients";
import { SiteBadge } from "@/components/ui/Status";
import { transitions } from "@/styles/design-tokens";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

const EYEBROW = "font-mono text-[11px] uppercase tracking-widest text-muted";
const BTN =
  "inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 px-4 text-xs transition-colors duration-150 hover:border-foreground/40 hover:bg-foreground/5 disabled:opacity-50";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <p className={EYEBROW}>{title}</p>
      <div className="mt-2 border-t border-foreground/10" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PanoramaxPhoto({ place }: { place: PlaceDTO }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["panoramax", place.id],
    queryFn: () => fetchPanoramax(place.lat, place.lon),
    staleTime: 24 * 60 * 60 * 1000,
  });
  if (isLoading) return <div className="aspect-video animate-pulse rounded-xl bg-foreground/5" />;
  if (isError) return <p className="text-xs text-muted">Panoramax indisponible.</p>;
  const photo = data?.photo;
  if (!photo) return <p className="text-xs text-muted">Aucune photo Panoramax à moins de 50 m.</p>;
  return (
    <a href={photo.viewerUrl} target="_blank" rel="noopener noreferrer" className="group block">
      {/* eslint-disable-next-line @next/next/no-img-element -- image distante, instances Panoramax variables */}
      <img
        src={photo.thumb}
        alt={`Photo de rue la plus proche de ${place.name}`}
        loading="lazy"
        className="aspect-video w-full rounded-xl object-cover transition-opacity duration-150 group-hover:opacity-90"
      />
      <span className="mt-2 block text-[11px] text-muted">
        Panoramax · {Math.round(photo.distance)} m{photo.date ? ` · ${new Date(photo.date).toLocaleDateString("fr-FR")}` : ""} ↗
      </span>
    </a>
  );
}

export function PlaceDetail({
  place,
  onClose,
  onUpdated,
}: {
  place: PlaceDTO;
  onClose: () => void;
  onUpdated: (p: PlaceDTO) => void;
}) {
  const [notes, setNotes] = useState(place.crm.notes);
  const [saved, setSaved] = useState(false);

  const crm = useMutation({
    mutationFn: (patch: Parameters<typeof updateCrm>[1]) => updateCrm(place.id, patch),
    onSuccess: (p) => {
      onUpdated(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });
  const check = useMutation({ mutationFn: () => checkSite(place.id), onSuccess: onUpdated });

  const site = place.site;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={transitions.ui}
      aria-label={`Fiche ${place.name}`}
      style={{ boxShadow: "var(--shadow-float)" }}
      className="scroll-thin fixed inset-x-2 bottom-2 top-20 z-30 overflow-y-auto rounded-2xl border border-foreground/10 bg-anthracite/95 p-5 sm:p-6 lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-[84px] lg:w-[26rem]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>
            {place.category}
            {place.quartier ? ` · ${place.quartier}` : ""}
          </p>
          <h2 className="mt-2 font-display text-3xl leading-tight">{place.name}</h2>
          {place.address && <p className="mt-1 text-sm text-muted">{place.address}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-sm transition-colors duration-150 hover:bg-foreground/10"
        >
          ✕
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Téléphone</dt>
        <dd>{place.phone ? <a href={`tel:${place.phone.replace(/\s/g, "")}`} className="hover:text-accent">{place.phone}</a> : "—"}</dd>
        <dt className="text-muted">Email</dt>
        <dd className="truncate">{place.email ? <a href={`mailto:${place.email}`} className="hover:text-accent">{place.email}</a> : "—"}</dd>
        <dt className="text-muted">Horaires</dt>
        <dd className="text-xs leading-relaxed">{place.openingHours ?? "—"}</dd>
      </dl>

      <Section title="Site web">
        <div className="flex items-center justify-between gap-3">
          <SiteBadge value={place.siteClass} />
          {place.website && (
            <button type="button" className={BTN} disabled={check.isPending} onClick={() => check.mutate()}>
              {check.isPending ? "Vérification…" : site ? "Revérifier" : "Vérifier le site"}
            </button>
          )}
        </div>
        {place.website && (
          <a href={place.website.startsWith("http") ? place.website : `https://${place.website}`} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate text-xs text-accent hover:underline">
            {place.website}
          </a>
        )}
        {site && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {site.reasons && <li>{site.reasons}</li>}
            <li>
              {site.httpStatus ? `HTTP ${site.httpStatus} · ` : ""}
              {site.https === null ? "" : site.https ? "HTTPS · " : "HTTP seul · "}
              {site.hasViewport === null ? "" : site.hasViewport ? "viewport ✓ · " : "pas de viewport · "}
              vérifié le {new Date(site.checkedAt).toLocaleString("fr-FR")}
            </li>
            {site.lastModified && <li>Last-Modified : {site.lastModified}</li>}
          </ul>
        )}
        {check.isError && <p className="mt-2 text-xs text-[var(--status-pas-de-site)]">{(check.error as Error).message}</p>}
      </Section>

      <Section title="Suivi">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Statut">
          {CRM_STATUSES.map((s: CrmStatus) => {
            const active = place.crm.status === s;
            const color = CRM_STATUS_COLORS[s];
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={crm.isPending}
                onClick={() => !active && crm.mutate({ status: s })}
                className="relative rounded-full border px-3 py-1.5 text-xs transition-[color,border-color] duration-200"
                style={{ color: active ? "var(--background)" : color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
              >
                {active && (
                  <motion.span
                    layoutId={`crm-active-${place.id}`}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 rounded-full"
                    style={{ background: color }}
                  />
                )}
                <span className="relative">{CRM_STATUS_LABELS[s]}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block">
          <span className={EYEBROW}>Relance</span>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={place.crm.followUp ?? ""}
              onChange={(e) => crm.mutate({ followUp: e.target.value || null })}
              className="h-9 rounded-full border border-foreground/15 bg-background px-3 text-xs outline-none focus:border-accent"
            />
            {[
              ["+3 j", 3],
              ["+1 sem", 7],
              ["+2 sem", 14],
            ].map(([label, days]) => (
              <button key={label} type="button" className={BTN} onClick={() => crm.mutate({ followUp: addDays(days as number) })}>
                {label}
              </button>
            ))}
            {place.crm.followUp && (
              <button type="button" className="px-2 text-xs text-muted hover:text-foreground" onClick={() => crm.mutate({ followUp: null })}>
                Effacer
              </button>
            )}
          </div>
        </label>

        <label className="mt-5 block">
          <span className={EYEBROW}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== place.crm.notes && crm.mutate({ notes })}
            rows={4}
            placeholder="Interlocuteur, besoins, objections…"
            className="mt-2 w-full resize-y rounded-xl border border-foreground/15 bg-background p-3 text-sm outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
          />
        </label>
        <p aria-live="polite" className={`h-4 text-[11px] transition-opacity duration-150 ${saved ? "text-[var(--status-site-ok)] opacity-100" : "opacity-0"}`}>
          Enregistré
        </p>
        {crm.isError && <p className="text-xs text-[var(--status-pas-de-site)]">{(crm.error as Error).message}</p>}
      </Section>

      <Section title={place.crm.status === "signe" ? "Facturation" : "Devis"}>
        <div className="flex flex-wrap items-center gap-2">
          <MoneyInput label="Prix du site" value={place.crm.amount} onCommit={(v) => crm.mutate({ amount: v })} />
          {place.crm.status === "signe" && (
            <MoneyInput label="Abonnement mensuel" suffix="€/mois" value={place.crm.monthly} onCommit={(v) => crm.mutate({ monthly: v })} />
          )}
        </div>
        {place.crm.status === "signe" && (
          <label className="mt-4 block">
            <span className={EYEBROW}>Signé le</span>
            <input
              type="date"
              value={place.crm.signedOn ?? ""}
              onChange={(e) => crm.mutate({ signedOn: e.target.value || null })}
              className="mt-2 h-9 rounded-full border border-foreground/15 bg-background px-3 text-xs outline-none focus:border-accent"
            />
          </label>
        )}
        <p className="mt-3 text-[11px] text-muted">
          {place.crm.status === "signe" ? "Compté dans le chiffre d'affaires du tableau de bord." : "Compté dans les devis en cours une fois « Maquette faite » ou « Visité »."}
        </p>
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          <a href={clientJsonUrl(place.id)} download="client.json" className={`${BTN} border-accent/60 text-accent`}>
            Générer client.json
          </a>
          <a href={`https://www.openstreetmap.org/${place.id}`} target="_blank" rel="noopener noreferrer" className={BTN}>
            Fiche OSM ↗
          </a>
        </div>
      </Section>

      <Section title="Photo de rue">
        <PanoramaxPhoto place={place} />
      </Section>
    </motion.aside>
  );
}
