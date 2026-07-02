import { dbAll, dbExec, dbGet } from './db';
import { calculateSplit } from './rateio';
import { newId } from './auth';

export type Barbecue = {
  id: string;
  owner_id: string;
  name: string;
  theme: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  description: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_receiver_name: string | null;
  notes: string | null;
  status: string;
  share_token: string;
  created_at: string;
};

export type Participant = {
  id: string;
  barbecue_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  participates_in_split: number;
  attendance_status: string;
  is_organizer: number;
  access_token: string;
  notes: string | null;
  active: number;
};

export type Expense = {
  id: string;
  barbecue_id: string;
  description: string;
  category: string | null;
  quantity: number;
  unit_value_cents: number;
  total_value_cents: number;
  purchase_date: string | null;
  paid_by_name: string | null;
  included_in_split: number;
  notes: string | null;
};

export type Contribution = {
  id: string;
  barbecue_id: string;
  participant_id: string | null;
  description: string;
  category: string | null;
  value_cents: number;
  quantity: number | null;
  status: string;
  notes: string | null;
};

export type Payment = {
  id: string;
  barbecue_id: string;
  participant_id: string;
  value_cents: number;
  payment_date: string | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
  receipt_url: string | null;
};

export async function listBarbecuesForOwner(ownerId: string): Promise<Barbecue[]> {
  return dbAll<Barbecue>(
    `SELECT * FROM barbecues WHERE owner_id = ? ORDER BY event_date DESC NULLS LAST, created_at DESC`,
    ownerId,
  );
}

export async function getBarbecue(id: string): Promise<Barbecue | null> {
  return (await dbGet<Barbecue>(`SELECT * FROM barbecues WHERE id = ?`, id)) ?? null;
}

export async function getBarbecueByShareToken(token: string): Promise<Barbecue | null> {
  return (
    (await dbGet<Barbecue>(`SELECT * FROM barbecues WHERE share_token = ?`, token)) ?? null
  );
}

export async function getParticipantByToken(token: string): Promise<Participant | null> {
  return (
    (await dbGet<Participant>(`SELECT * FROM participants WHERE access_token = ?`, token)) ??
    null
  );
}

export async function listParticipants(barbecueId: string): Promise<Participant[]> {
  return dbAll<Participant>(
    `SELECT * FROM participants WHERE barbecue_id = ? ORDER BY created_at ASC`,
    barbecueId,
  );
}

export type ParticipantHistory = Participant & { barbecue_name: string; event_date: string | null };

export async function listParticipantsForOwner(ownerId: string): Promise<ParticipantHistory[]> {
  return dbAll<ParticipantHistory>(
    `SELECT p.*, b.name AS barbecue_name, b.event_date
     FROM participants p
     JOIN barbecues b ON b.id = p.barbecue_id
     WHERE b.owner_id = ?
     ORDER BY p.name ASC, b.event_date DESC NULLS LAST`,
    ownerId,
  );
}

export async function listReusableParticipantsForBarbecue(
  ownerId: string,
  barbecueId: string,
): Promise<ParticipantHistory[]> {
  return dbAll<ParticipantHistory>(
    `SELECT p.*, b.name AS barbecue_name, b.event_date
     FROM participants p
     JOIN barbecues b ON b.id = p.barbecue_id
     WHERE b.owner_id = ?
       AND p.barbecue_id <> ?
       AND p.active = 1
       AND NOT EXISTS (
         SELECT 1
         FROM participants current_p
         WHERE current_p.barbecue_id = ?
           AND current_p.active = 1
           AND (
             (p.email IS NOT NULL AND current_p.email IS NOT NULL AND lower(current_p.email) = lower(p.email))
             OR (p.phone IS NOT NULL AND current_p.phone IS NOT NULL AND current_p.phone = p.phone)
             OR (
               (p.email IS NULL OR p.email = '')
               AND (p.phone IS NULL OR p.phone = '')
               AND lower(current_p.name) = lower(p.name)
             )
           )
       )
     ORDER BY p.name ASC, b.event_date DESC NULLS LAST, b.created_at DESC`,
    ownerId,
    barbecueId,
    barbecueId,
  );
}

export async function listExpenses(barbecueId: string): Promise<Expense[]> {
  return dbAll<Expense>(
    `SELECT * FROM expenses WHERE barbecue_id = ? ORDER BY created_at ASC`,
    barbecueId,
  );
}

export async function listContributions(barbecueId: string): Promise<Contribution[]> {
  return dbAll<Contribution>(
    `SELECT * FROM contributions WHERE barbecue_id = ? ORDER BY created_at ASC`,
    barbecueId,
  );
}

export async function listPayments(barbecueId: string): Promise<Payment[]> {
  return dbAll<Payment>(
    `SELECT * FROM payments WHERE barbecue_id = ? ORDER BY created_at ASC`,
    barbecueId,
  );
}

export type ParticipantSummary = {
  participant: Participant;
  contributionCents: number;
  amountDueCents: number;
  paidCents: number;
  balanceCents: number;
};

export type BarbecueSummary = {
  totalExpensesCents: number;
  totalSplitCents: number;
  totalContributionsCents: number;
  totalLeftoversCents: number;
  totalPaidCents: number;
  totalPendingCents: number;
  baseValueCents: number;
  participantCount: number;
  splitParticipantCount: number;
  rows: ParticipantSummary[];
};

export async function computeBarbecueSummary(barbecueId: string): Promise<BarbecueSummary> {
  const [participantsAll, expenses, contributionsAll, paymentsAll] = await Promise.all([
    listParticipants(barbecueId),
    listExpenses(barbecueId),
    listContributions(barbecueId),
    listPayments(barbecueId),
  ]);
  const participants = participantsAll.filter((p) => p.active);
  const contributions = contributionsAll.filter((c) => c.status === 'aprovada');
  const payments = paymentsAll.filter(
    (p) => p.status === 'informado' || p.status === 'confirmado',
  );

  const totalExpensesCents = expenses.reduce((a, e) => a + e.total_value_cents, 0);
  const totalSplitCents = expenses
    .filter((e) => e.included_in_split)
    .reduce((a, e) => a + e.total_value_cents, 0);

  const participantContribs = contributions.filter((c) => c.participant_id !== null);
  const leftovers = contributions.filter((c) => c.participant_id === null);
  const totalLeftoversCents = leftovers.reduce((a, c) => a + c.value_cents, 0);
  const totalContributionsCents = participantContribs.reduce((a, c) => a + c.value_cents, 0);

  const splitters = participants.filter((p) => p.participates_in_split);

  const contribByParticipant = new Map<string, number>();
  for (const c of participantContribs) {
    contribByParticipant.set(
      c.participant_id!,
      (contribByParticipant.get(c.participant_id!) ?? 0) + c.value_cents,
    );
  }

  const splitInput = splitters.map((p) => ({
    participantId: p.id,
    contributionCents: contribByParticipant.get(p.id) ?? 0,
  }));

  const result = calculateSplit(totalSplitCents, splitInput);

  // Sobras: o organizador ficou com o item, então ele paga o valor cheio
  // e os demais participantes recebem o valor dividido como desconto.
  if (totalLeftoversCents > 0) {
    const organizerIds = new Set(splitters.filter((p) => p.is_organizer).map((p) => p.id));
    const nonOrgSplitters = splitters.filter((p) => !organizerIds.has(p.id));
    const nonOrgCount = nonOrgSplitters.length;

    if (organizerIds.size > 0 && nonOrgCount > 0) {
      const floorDiscount = Math.floor(totalLeftoversCents / nonOrgCount);
      const remainder = totalLeftoversCents - floorDiscount * nonOrgCount;

      // Desconto dos não-organizadores (determinístico: remainder primeiros levam +1)
      let remainderApplied = 0;
      for (const p of nonOrgSplitters) {
        const r = result.rows.find((row) => row.participantId === p.id);
        if (!r) continue;
        const discount = remainderApplied < remainder ? floorDiscount + 1 : floorDiscount;
        r.amountDueCents = Math.max(0, r.amountDueCents - discount);
        remainderApplied++;
      }

      // Organizador absorve o valor cheio da sobra
      const orgCount = organizerIds.size;
      const floorOrgAdd = Math.floor(totalLeftoversCents / orgCount);
      const orgRemainder = totalLeftoversCents - floorOrgAdd * orgCount;
      let orgRemainderApplied = 0;
      for (const orgId of organizerIds) {
        const r = result.rows.find((row) => row.participantId === orgId);
        if (!r) continue;
        r.amountDueCents += floorOrgAdd + (orgRemainderApplied < orgRemainder ? 1 : 0);
        orgRemainderApplied++;
      }
    }
  }

  const paidByParticipant = new Map<string, number>();
  for (const pay of payments) {
    paidByParticipant.set(
      pay.participant_id,
      (paidByParticipant.get(pay.participant_id) ?? 0) + pay.value_cents,
    );
  }

  const rowsById = new Map<string, (typeof result.rows)[number]>();
  for (const r of result.rows) rowsById.set(r.participantId, r);

  const rows: ParticipantSummary[] = participants.map((p) => {
    const r = rowsById.get(p.id);
    const amountDue = r?.amountDueCents ?? 0;
    const paid = paidByParticipant.get(p.id) ?? 0;
    return {
      participant: p,
      contributionCents: contribByParticipant.get(p.id) ?? 0,
      amountDueCents: amountDue,
      paidCents: paid,
      balanceCents: amountDue - paid,
    };
  });

  const totalPaidCents = rows.reduce((a, r) => a + r.paidCents, 0);
  const totalPendingCents = rows.reduce((a, r) => a + Math.max(0, r.balanceCents), 0);

  return {
    totalExpensesCents,
    totalSplitCents,
    totalContributionsCents,
    totalLeftoversCents,
    totalPaidCents,
    totalPendingCents,
    baseValueCents: result.baseValueCents,
    participantCount: participants.length,
    splitParticipantCount: splitters.length,
    rows,
  };
}

export async function recordAudit(
  barbecueId: string | null,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldData: unknown,
  newData: unknown,
): Promise<void> {
  await dbExec(
    `INSERT INTO audit_logs (id, barbecue_id, user_id, action, entity_type, entity_id, old_data, new_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    barbecueId,
    userId,
    action,
    entityType,
    entityId,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
  );
}
