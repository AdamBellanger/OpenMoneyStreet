"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrmChip } from "@/components/ui/Status";
import { fetchDashboard, updateCrm, type CrmPatch } from "@/lib/api-client";
import { formatEur, placeSlug, type FollowUpDTO } from "@/lib/domain";

const EYEBROW = "font-mono text-[11px] uppercase tracking-widest text-muted";

/** Champ en euros : enregistré à la sortie du champ, vide = pas de montant. */
export function MoneyInput({
  value,
  label,
  suffix,
  onCommit,
}: {
  value: number | null;
  label: string;
  suffix?: string;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : String(value));
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background px-3 transition-colors duration-150 focus-within:border-accent">
      <span className="sr-only">{label}</span>
      <input
        inputMode="numeric"
        value={shown}
        placeholder="0"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
        onBlur={() => {
          if (draft === null) return;
          const next = draft === "" ? null : Number(draft);
          setDraft(null);
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-9 w-20 bg-transparent text-right font-mono text-sm outline-none"
      />
      <span className="text-xs text-muted">{suffix ?? "€"}</span>
    </label>
  );
}

function Row({ p, signed }: { p: FollowUpDTO; signed: boolean }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (patch: CrmPatch) => updateCrm(p.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
  return (
    <li className="grid gap-3 border-b border-foreground/10 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/prospection?city=${encodeURIComponent(p.cityName)}&place=${placeSlug(p.id)}`}
            className="font-display text-xl transition-colors duration-150 hover:text-accent"
          >
            {p.name}
          </Link>
          {!signed && <CrmChip value={p.crm.status} />}
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {p.category} · {p.cityName}
          {signed && p.crm.signedOn ? ` · signé le ${new Date(`${p.crm.signedOn}T12:00:00`).toLocaleDateString("fr-FR")}` : ""}
          {p.phone ? ` · ${p.phone}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MoneyInput label={`Prix du site pour ${p.name}`} value={p.crm.amount} onCommit={(v) => m.mutate({ amount: v })} />
        {signed && (
          <MoneyInput label={`Abonnement mensuel de ${p.name}`} suffix="€/mois" value={p.crm.monthly} onCommit={(v) => m.mutate({ monthly: v })} />
        )}
        {m.isError && <span className="text-xs text-[var(--status-pas-de-site)]">{(m.error as Error).message}</span>}
      </div>
    </li>
  );
}

function Section({ title, total, items, signed, empty }: { title: string; total: string; items: FollowUpDTO[]; signed: boolean; empty: string }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>
          {title} ({items.length})
        </p>
        <p className="font-mono text-xs text-muted">{total}</p>
      </div>
      <div className="mt-3 border-t border-foreground/10" />
      {items.length === 0 ? <p className="mt-6 text-sm text-muted">{empty}</p> : <ul>{items.map((p) => <Row key={p.id} p={p} signed={signed} />)}</ul>}
    </section>
  );
}

export function Clients() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard, staleTime: 0 });
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10">
        <p className={EYEBROW}>Facturation</p>
        <div className="mt-3 border-t border-foreground/10" />
        <h1 className="mt-8 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">Clients</h1>
        <p className="mt-4 max-w-xl text-sm text-muted">
          Renseignez le prix du site et l&apos;abonnement mensuel : le tableau de bord calcule le chiffre d&apos;affaires à partir de ces montants.
        </p>
        {isLoading && <p className="mt-10 text-sm text-muted">Chargement…</p>}
        {isError && <p className="mt-10 text-sm text-[var(--status-pas-de-site)]">{(error as Error).message}</p>}
        {data && (
          <>
            <Section
              title="Clients signés"
              total={`${formatEur(data.oneOff)} + ${formatEur(data.mrr)}/mois`}
              items={data.signedClients}
              signed
              empty="Aucun client signé. Passez un commerce en « Signé » depuis sa fiche dans Prospection."
            />
            <Section
              title="Devis en cours"
              total={formatEur(data.pipelineValue)}
              items={data.pipeline}
              signed={false}
              empty="Aucun devis en cours."
            />
          </>
        )}
      </main>
    </div>
  );
}
