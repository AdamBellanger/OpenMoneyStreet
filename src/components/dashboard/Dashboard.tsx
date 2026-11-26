"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrmChip } from "@/components/ui/Status";
import { fetchDashboard } from "@/lib/api-client";
import {
  CRM_STATUSES,
  CRM_STATUS_COLORS,
  CRM_STATUS_LABELS,
  formatEur,
  placeSlug,
  type DashboardDTO,
  type FollowUpDTO,
} from "@/lib/domain";
import { transitions } from "@/styles/design-tokens";

const EYEBROW = "font-mono text-[11px] uppercase tracking-widest text-muted";
const CARD = "rounded-2xl border border-foreground/10 bg-anthracite/40 p-6";

function monthLabel(ym: string) {
  return new Date(`${ym}-15T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={CARD}>
      <p className={EYEBROW}>{label}</p>
      <p className={`mt-3 font-display text-4xl leading-none tracking-tight ${accent ? "text-accent" : ""}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Signatures par mois : barres d'une seule teinte, valeur écrite au-dessus de chaque barre. */
function MonthlyChart({ months }: { months: DashboardDTO["months"] }) {
  const max = Math.max(...months.map((m) => m.oneOff), 1);
  const total = months.reduce((s, m) => s + m.oneOff, 0);
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>Sites vendus · 6 derniers mois</p>
        <p className="text-xs text-muted">{formatEur(total)}</p>
      </div>
      <div className="mt-6 flex h-48 items-end gap-3" role="img" aria-label={`Sites vendus par mois : ${months.map((m) => `${monthLabel(m.month)} ${formatEur(m.oneOff)}`).join(", ")}`}>
        {months.map((m) => (
          <div
            key={m.month}
            title={`${monthLabel(m.month)} : ${formatEur(m.oneOff)} · ${m.clients} client${m.clients > 1 ? "s" : ""}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span className="mb-1 text-center font-mono text-[11px] text-muted">{m.oneOff > 0 ? formatEur(m.oneOff) : ""}</span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((m.oneOff / max) * 100, m.oneOff > 0 ? 4 : 1)}%` }}
              transition={transitions.ui}
              className={`rounded-t-md ${m.oneOff > 0 ? "bg-accent" : "bg-foreground/15"}`}
              style={{ maxHeight: "calc(100% - 20px)" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 border-t border-foreground/10 pt-2">
        {months.map((m) => (
          <span key={m.month} className="min-w-0 flex-1 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
            {monthLabel(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Funnel({ funnel }: { funnel: DashboardDTO["funnel"] }) {
  const max = Math.max(...CRM_STATUSES.map((s) => funnel[s]), 1);
  return (
    <div className={CARD}>
      <p className={EYEBROW}>Suivi des prospects</p>
      <ul className="mt-5 space-y-3">
        {CRM_STATUSES.map((s) => (
          <li key={s} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="truncate" style={{ color: CRM_STATUS_COLORS[s] }}>
              {CRM_STATUS_LABELS[s]}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${(funnel[s] / max) * 100}%` }}
                transition={transitions.ui}
                className="block h-full rounded-full"
                style={{ background: CRM_STATUS_COLORS[s] }}
              />
            </span>
            <span className="text-right font-mono text-xs">{funnel[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClientList({ title, items, empty, href }: { title: string; items: FollowUpDTO[]; empty: string; href: string }) {
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between">
        <p className={EYEBROW}>{title}</p>
        <Link href={href} className="text-xs text-muted transition-colors duration-150 hover:text-accent">
          Tout voir →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-foreground/10">
          {items.slice(0, 5).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/prospection?city=${encodeURIComponent(p.cityName)}&place=${placeSlug(p.id)}`}
                  className="block truncate text-sm transition-colors duration-150 hover:text-accent"
                >
                  {p.name}
                </Link>
                <p className="truncate text-xs text-muted">
                  {p.category} · {p.cityName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm">{p.crm.amount != null ? formatEur(p.crm.amount) : "—"}</p>
                {p.crm.monthly ? <p className="font-mono text-[11px] text-muted">+ {formatEur(p.crm.monthly)}/mois</p> : <CrmChip value={p.crm.status} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard, staleTime: 0 });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-10">
        <p className={EYEBROW}>
          {data ? new Date(`${data.today}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Aujourd'hui"}
        </p>
        <div className="mt-3 border-t border-foreground/10" />
        <h1 className="mt-8 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">Tableau de bord</h1>

        {isLoading && <p className="mt-10 text-sm text-muted">Chargement…</p>}
        {isError && <p className="mt-10 text-sm text-[var(--status-pas-de-site)]">{(error as Error).message}</p>}

        {data && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={transitions.ui} className="mt-10 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className={`${CARD} md:col-span-2`}>
                <p className={EYEBROW}>Chiffre d&apos;affaires</p>
                <p className="mt-4 font-display text-6xl leading-none tracking-tight sm:text-7xl">{formatEur(data.oneOff + data.recurringEarned)}</p>
                <p className="mt-4 text-sm text-muted">
                  {formatEur(data.oneOff)} de sites vendus + {formatEur(data.recurringEarned)} d&apos;abonnements déjà courus
                </p>
              </div>
              <div className={CARD}>
                <p className={EYEBROW}>Récurrent</p>
                <p className="mt-4 font-display text-5xl leading-none tracking-tight text-accent">
                  {formatEur(data.mrr)}
                  <span className="text-xl text-muted"> /mois</span>
                </p>
                <p className="mt-4 text-sm text-muted">{formatEur(data.mrr * 12)} sur 12 mois</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Clients signés" value={String(data.clients)} hint={data.winRate != null ? `${Math.round(data.winRate * 100)} % de signature (signés / décisions)` : "Pas encore de décision"} />
              <Kpi label="Devis en cours" value={formatEur(data.pipelineValue)} hint={`${data.pipelineCount} commerce${data.pipelineCount > 1 ? "s" : ""} (maquette faite ou visité)`} />
              <Kpi label="Relances à faire" value={String(data.followUpsDue)} hint="Du jour ou en retard" accent={data.followUpsDue > 0} />
              <Kpi label="Sans site" value={String(data.withoutSite)} hint={`sur ${data.places} commerces dans ${data.cities.length} ville${data.cities.length > 1 ? "s" : ""}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <MonthlyChart months={data.months} />
              <Funnel funnel={data.funnel} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ClientList title="Derniers clients" items={data.signedClients} href="/clients" empty="Aucun client pour l'instant. Passez un commerce en « Signé » depuis sa fiche, puis renseignez le montant." />
              <ClientList title="Devis en cours" items={data.pipeline} href="/clients" empty="Aucun devis en cours. Mettez un commerce en « Maquette faite » ou « Visité »." />
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
