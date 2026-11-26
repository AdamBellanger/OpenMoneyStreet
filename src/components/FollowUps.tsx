"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrmChip, SiteBadge } from "@/components/ui/Status";
import { fetchFollowUps, updateCrm } from "@/lib/api-client";
import { CRM_STATUSES, CRM_STATUS_LABELS, type CrmStatus, type FollowUpDTO } from "@/lib/domain";
import { transitions } from "@/styles/design-tokens";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function FollowUpRow({ p, today }: { p: FollowUpDTO; today: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (patch: Parameters<typeof updateCrm>[1]) => updateCrm(p.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relances"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
  const late = p.crm.followUp! < today;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={transitions.ui}
      className="grid grid-cols-1 gap-4 border-b border-foreground/10 py-5 transition-colors duration-[120ms] hover:bg-foreground/[0.03] md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center"
    >
      <div className="font-mono text-xs">
        <span className={late ? "text-[var(--status-pas-de-site)]" : "text-accent"}>
          {new Date(p.crm.followUp!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
        </span>
        {late && <span className="ml-2 uppercase tracking-widest text-muted">retard</span>}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/prospection?city=${encodeURIComponent(p.cityName)}&place=${encodeURIComponent(p.id)}`}
            className="font-display text-2xl transition-colors duration-150 hover:text-accent"
          >
            {p.name}
          </Link>
          <CrmChip value={p.crm.status} />
          <SiteBadge value={p.siteClass} />
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {p.category} · {p.address || p.cityName}
          {p.phone && (
            <>
              {" · "}
              <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-foreground hover:text-accent">
                {p.phone}
              </a>
            </>
          )}
        </p>
        {p.crm.notes && <p className="mt-2 line-clamp-2 text-sm">{p.crm.notes}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Statut de ${p.name}`}
          value={p.crm.status}
          disabled={m.isPending}
          onChange={(e) => m.mutate({ status: e.target.value as CrmStatus })}
          className="h-9 rounded-full border border-foreground/15 bg-anthracite px-3 text-xs outline-none focus:border-accent"
        >
          {CRM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CRM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {[
          ["+3 j", 3],
          ["+1 sem", 7],
        ].map(([label, days]) => (
          <button
            key={label}
            type="button"
            disabled={m.isPending}
            onClick={() => m.mutate({ followUp: addDays(today, days as number) })}
            className="h-9 rounded-full border border-foreground/15 px-4 text-xs transition-colors duration-150 hover:border-foreground/40 hover:bg-foreground/5"
          >
            {label}
          </button>
        ))}
      </div>
    </motion.li>
  );
}

export function FollowUps() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["relances"], queryFn: fetchFollowUps });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {data ? new Date(`${data.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Aujourd'hui"}
        </p>
        <div className="mt-3 border-t border-foreground/10" />
        <h1 className="mt-8 font-display text-6xl leading-[0.95] tracking-tight">
          Relances du jour
          {data && <span className="text-muted"> ({data.places.length})</span>}
        </h1>

        {isLoading && <p className="mt-10 text-sm text-muted">Chargement…</p>}
        {isError && <p className="mt-10 text-sm text-[var(--status-pas-de-site)]">{(error as Error).message}</p>}
        {data && data.places.length === 0 && (
          <p className="mt-10 text-sm text-muted">Rien à relancer aujourd&apos;hui. Les dates de relance se posent depuis la fiche d&apos;un commerce.</p>
        )}
        <ul className="mt-10">
          <AnimatePresence initial={false}>
            {data?.places.map((p) => <FollowUpRow key={p.id} p={p} today={data.date} />)}
          </AnimatePresence>
        </ul>
      </main>
    </div>
  );
}
