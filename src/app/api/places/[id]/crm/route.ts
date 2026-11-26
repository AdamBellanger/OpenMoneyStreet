import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { CRM_STATUSES, isValidPlaceId, placeIdFromSlug, todayParis, type CrmStatus } from "@/lib/domain";
import { loadPlace, toPlaceDTO } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/places/node-123/crm  { status?, notes?, followUp? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = placeIdFromSlug((await params).id);
  if (!isValidPlaceId(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });
  const row = loadPlace(id);
  if (!row) return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = body.status;
  const notes = body.notes;
  const followUp = body.followUp;

  if (status !== undefined && !CRM_STATUSES.includes(status as CrmStatus)) {
    return NextResponse.json({ error: "statut invalide" }, { status: 400 });
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 10_000)) {
    return NextResponse.json({ error: "notes invalides" }, { status: 400 });
  }
  if (followUp !== undefined && followUp !== null && !(typeof followUp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(followUp))) {
    return NextResponse.json({ error: "date de relance invalide (AAAA-MM-JJ)" }, { status: 400 });
  }

  const { amount, monthly, signedOn } = body;
  const validMoney = (v: unknown) =>
    v === undefined || v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000);
  if (!validMoney(amount) || !validMoney(monthly)) {
    return NextResponse.json({ error: "montant invalide (entier en €, de 0 à 1 000 000)" }, { status: 400 });
  }
  if (signedOn !== undefined && signedOn !== null && !(typeof signedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(signedOn))) {
    return NextResponse.json({ error: "date de signature invalide (AAAA-MM-JJ)" }, { status: 400 });
  }

  const current = row.crm;
  const nextStatus = (status as CrmStatus | undefined) ?? current?.status ?? "a_contacter";
  const keep = <T,>(next: T | undefined, prev: T | null | undefined): T | null => (next === undefined ? (prev ?? null) : next);
  let nextSignedOn = keep(signedOn as string | null | undefined, current?.signedOn);
  // Passage en « Signé » : la signature est datée d'aujourd'hui si rien n'est renseigné.
  if (nextStatus === "signe" && !nextSignedOn) nextSignedOn = todayParis();
  const values = {
    placeId: id,
    amount: keep(amount as number | null | undefined, current?.amount),
    monthly: keep(monthly as number | null | undefined, current?.monthly),
    signedOn: nextSignedOn,
    status: nextStatus,
    notes: (notes as string | undefined) ?? current?.notes ?? "",
    followUp: followUp === undefined ? (current?.followUp ?? null) : (followUp as string | null),
    updatedAt: new Date(),
  };
  getDb().insert(schema.crm).values(values).onConflictDoUpdate({ target: schema.crm.placeId, set: values }).run();

  const updated = loadPlace(id)!;
  return NextResponse.json(toPlaceDTO(updated.place, updated.check, updated.crm));
}
