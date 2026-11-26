import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  CLOSED_STATUSES,
  CRM_STATUSES,
  todayParis,
  type CrmStatus,
  type DashboardDTO,
  type FollowUpDTO,
  type MonthPoint,
} from "./domain";
import { toPlaceDTO } from "./places";

const { cities, places, siteChecks, crm } = schema;

/** Mois entiers écoulés entre deux dates AAAA-MM-JJ (0 si la signature est ce mois-ci). */
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0));
}

function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function loadDashboard(): DashboardDTO {
  const db = getDb();
  const today = todayParis();

  const totalPlaces = db.select({ n: sql<number>`count(*)` }).from(places).get()?.n ?? 0;
  const withoutSite =
    db
      .select({ n: sql<number>`count(*)` })
      .from(places)
      .leftJoin(siteChecks, eq(siteChecks.placeId, places.id))
      .where(sql`${places.website} is null or ${siteChecks.classification} = 'pas_de_site'`)
      .get()?.n ?? 0;
  const cityRows = db.select({ name: cities.name, places: cities.placeCount }).from(cities).all();

  const rows = db
    .select({ place: places, check: siteChecks, crm, cityName: cities.name })
    .from(crm)
    .innerJoin(places, eq(places.id, crm.placeId))
    .leftJoin(siteChecks, eq(siteChecks.placeId, places.id))
    .leftJoin(cities, eq(cities.key, places.cityKey))
    .all();

  const funnel = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0])) as Record<CrmStatus, number>;
  const signedClients: FollowUpDTO[] = [];
  const pipeline: FollowUpDTO[] = [];
  let oneOff = 0;
  let mrr = 0;
  let recurringEarned = 0;
  let pipelineValue = 0;
  let followUpsDue = 0;
  const byMonth = new Map<string, MonthPoint>(lastMonths(today, 6).map((m) => [m, { month: m, oneOff: 0, clients: 0 }]));

  for (const r of rows) {
    const dto: FollowUpDTO = { ...toPlaceDTO(r.place, r.check, r.crm), cityName: r.cityName ?? "" };
    const status = r.crm.status;
    funnel[status]++;
    if (r.crm.followUp && r.crm.followUp <= today && !CLOSED_STATUSES.includes(status)) followUpsDue++;

    if (status === "signe") {
      signedClients.push(dto);
      oneOff += r.crm.amount ?? 0;
      mrr += r.crm.monthly ?? 0;
      if (r.crm.signedOn) {
        recurringEarned += (r.crm.monthly ?? 0) * monthsBetween(r.crm.signedOn, today);
        const point = byMonth.get(r.crm.signedOn.slice(0, 7));
        if (point) {
          point.oneOff += r.crm.amount ?? 0;
          point.clients++;
        }
      }
    } else if (status === "maquette_faite" || status === "visite") {
      pipeline.push(dto);
      pipelineValue += r.crm.amount ?? 0;
    }
  }

  signedClients.sort((a, b) => (b.crm.signedOn ?? "").localeCompare(a.crm.signedOn ?? ""));
  pipeline.sort((a, b) => (b.crm.amount ?? 0) - (a.crm.amount ?? 0));
  const decided = funnel.signe + funnel.refus;

  return {
    today,
    places: totalPlaces,
    withoutSite,
    cities: cityRows,
    funnel,
    clients: funnel.signe,
    oneOff,
    mrr,
    recurringEarned,
    pipelineCount: pipeline.length,
    pipelineValue,
    winRate: decided > 0 ? funnel.signe / decided : null,
    months: [...byMonth.values()],
    signedClients,
    pipeline,
    followUpsDue,
  };
}
