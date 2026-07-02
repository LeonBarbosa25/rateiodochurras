'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { dbAll, dbExec, dbGet } from './db';
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  newId,
  newToken,
  verifyPassword,
} from './auth';
import { parseBRL } from './money';
import { computeBarbecueSummary, getBarbecue, recordAudit } from './queries';

async function requireUser() {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u!;
}
async function requireOwner(barbecueId: string) {
  const u = await requireUser();
  const b = await getBarbecue(barbecueId);
  if (!b) throw new Error('Churrasco não encontrado');
  if (b.owner_id !== u.id) throw new Error('Sem permissão');
  return { user: u, barbecue: b };
}

function onlyDigits(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

async function uploadReceipt(file: FormDataEntryValue | null, paymentId: string): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) throw new Error('Comprovante deve ser PDF, JPG, PNG ou WEBP');
  if (file.size > 8 * 1024 * 1024) throw new Error('Comprovante deve ter no máximo 8 MB');
  const extension = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const blob = await put(`comprovantes/${paymentId}.${extension}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}

// --- Auth ---

export async function registerAction(formData: FormData) {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });
  const data = schema.parse({
    name: formData.get('name'),
    email: String(formData.get('email') || '').toLowerCase(),
    password: formData.get('password'),
  });
  const existing = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', data.email);
  if (existing) throw new Error('E-mail já cadastrado');
  const id = newId();
  await dbExec(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
    id,
    data.name,
    data.email,
    hashPassword(data.password),
  );
  await createSession(id);
  redirect('/');
}

export async function loginAction(formData: FormData) {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const data = schema.parse({
    email: String(formData.get('email') || '').toLowerCase(),
    password: formData.get('password'),
  });
  const row = await dbGet<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = ?',
    data.email,
  );
  if (!row || !verifyPassword(data.password, row.password_hash)) {
    throw new Error('E-mail ou senha incorretos');
  }
  await createSession(row.id);
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

// --- Churrasco ---

export async function createBarbecueAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    name: z.string().min(2),
    theme: z.string().optional(),
    event_date: z.string().optional(),
    event_time: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    pix_key: z.string().optional(),
    pix_key_type: z.string().optional(),
    pix_receiver_name: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const id = newId();
  const token = newToken(24);
  await dbExec(
    `INSERT INTO barbecues
      (id, owner_id, name, theme, event_date, event_time, location, description, pix_key, pix_key_type, pix_receiver_name, notes, share_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    data.name,
    data.theme ?? null,
    data.event_date ?? null,
    data.event_time ?? null,
    data.location ?? null,
    data.description ?? null,
    data.pix_key ?? null,
    data.pix_key_type ?? null,
    data.pix_receiver_name ?? null,
    data.notes ?? null,
    token,
  );
  await recordAudit(id, user.id, 'create', 'barbecue', id, null, data);
  redirect(`/churrasco/${id}`);
}

export async function updateBarbecueAction(formData: FormData) {
  const id = String(formData.get('id'));
  const { user } = await requireOwner(id);
  const schema = z.object({
    name: z.string().min(2),
    theme: z.string().optional(),
    event_date: z.string().optional(),
    event_time: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    pix_key: z.string().optional(),
    pix_key_type: z.string().optional(),
    pix_receiver_name: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  await dbExec(
    `UPDATE barbecues
     SET name = ?, theme = ?, event_date = ?, event_time = ?, location = ?, description = ?,
         pix_key = ?, pix_key_type = ?, pix_receiver_name = ?, notes = ?, updated_at = now()
     WHERE id = ?`,
    data.name,
    data.theme || null,
    data.event_date || null,
    data.event_time || null,
    data.location || null,
    data.description || null,
    data.pix_key || null,
    data.pix_key_type || null,
    data.pix_receiver_name || null,
    data.notes || null,
    id,
  );
  await recordAudit(id, user.id, 'update', 'barbecue', id, null, data);
  revalidatePath('/');
  revalidatePath(`/churrasco/${id}`);
  revalidatePath(`/churrasco/${id}/compartilhar`);
}

export async function updateBarbecueStatusAction(formData: FormData) {
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  const { user } = await requireOwner(id);
  await dbExec('UPDATE barbecues SET status = ?, updated_at = now() WHERE id = ?', status, id);
  await recordAudit(id, user.id, 'update_status', 'barbecue', id, null, { status });
  revalidatePath(`/churrasco/${id}`);
}

export async function deleteBarbecueAction(formData: FormData) {
  const id = String(formData.get('id'));
  const { user } = await requireOwner(id);
  await dbExec('DELETE FROM barbecues WHERE id = ?', id);
  await recordAudit(null, user.id, 'delete', 'barbecue', id, null, null);
  redirect('/');
}

// --- Participantes ---

export async function createParticipantAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    participates_in_split: z.string().optional(),
    is_organizer: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const id = newId();
  const token = newToken(24);
  await dbExec(
    `INSERT INTO participants (id, barbecue_id, name, email, phone, participates_in_split, is_organizer, access_token, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    barbecueId,
    data.name,
    data.email || null,
    onlyDigits(data.phone),
    data.participates_in_split === 'on' || data.participates_in_split === '1' ? 1 : 0,
    data.is_organizer === 'on' || data.is_organizer === '1' ? 1 : 0,
    token,
    data.notes || null,
  );
  await recordAudit(barbecueId, user.id, 'create', 'participant', id, null, data);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/participantes`);
}

export async function addParticipantsFromHistoryAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const { user } = await requireOwner(barbecueId);
  const sourceIds = formData
    .getAll('participant_ids')
    .map((value) => String(value))
    .filter(Boolean);

  if (sourceIds.length === 0) return;

  const placeholders = sourceIds.map(() => '?').join(', ');
  const sources = await dbAll<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    participates_in_split: number;
    is_organizer: number;
  }>(
    `SELECT p.id, p.name, p.email, p.phone, p.participates_in_split, p.is_organizer
     FROM participants p
     JOIN barbecues b ON b.id = p.barbecue_id
     WHERE b.owner_id = ?
       AND p.barbecue_id <> ?
       AND p.active = 1
       AND p.id IN (${placeholders})`,
    user.id,
    barbecueId,
    ...sourceIds,
  );

  let imported = 0;
  for (const source of sources) {
    const existing = source.email
      ? await dbGet<{ id: string }>(
          `SELECT id
           FROM participants
           WHERE barbecue_id = ? AND active = 1 AND email IS NOT NULL AND lower(email) = lower(?)
           LIMIT 1`,
          barbecueId,
          source.email,
        )
      : source.phone
        ? await dbGet<{ id: string }>(
            `SELECT id
             FROM participants
             WHERE barbecue_id = ? AND active = 1 AND phone IS NOT NULL AND phone = ?
             LIMIT 1`,
            barbecueId,
            source.phone,
          )
        : await dbGet<{ id: string }>(
            `SELECT id
             FROM participants
             WHERE barbecue_id = ? AND active = 1 AND lower(name) = lower(?)
             LIMIT 1`,
            barbecueId,
            source.name,
          );
    if (existing) continue;

    const id = newId();
    await dbExec(
      `INSERT INTO participants (id, barbecue_id, name, email, phone, participates_in_split, is_organizer, access_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      barbecueId,
      source.name,
      source.email,
      source.phone,
      source.participates_in_split ? 1 : 0,
      source.is_organizer ? 1 : 0,
      newToken(24),
    );
    imported++;
  }

  if (imported > 0) {
    await recordAudit(barbecueId, user.id, 'import_from_history', 'participant', barbecueId, null, {
      sourceIds,
      imported,
    });
  }
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/participantes`);
}

export async function updateParticipantSplitAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const participantId = String(formData.get('participant_id'));
  const value = formData.get('value') === '1' ? 1 : 0;
  await requireOwner(barbecueId);
  await dbExec('UPDATE participants SET participates_in_split = ? WHERE id = ?', value, participantId);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/participantes`);
}

export async function updateParticipantAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const participantId = String(formData.get('participant_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    participates_in_split: z.string().optional(),
    is_organizer: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  await dbExec(
    `UPDATE participants
     SET name = ?, email = ?, phone = ?, participates_in_split = ?, is_organizer = ?, notes = ?, updated_at = now()
     WHERE id = ? AND barbecue_id = ?`,
    data.name,
    data.email || null,
    onlyDigits(data.phone),
    data.participates_in_split === 'on' || data.participates_in_split === '1' ? 1 : 0,
    data.is_organizer === 'on' || data.is_organizer === '1' ? 1 : 0,
    data.notes || null,
    participantId,
    barbecueId,
  );
  await recordAudit(barbecueId, user.id, 'update', 'participant', participantId, null, data);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/participantes`);
  revalidatePath(`/churrasco/${barbecueId}/compartilhar`);
}

export async function deleteParticipantAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const participantId = String(formData.get('participant_id'));
  const { user } = await requireOwner(barbecueId);
  await dbExec('DELETE FROM participants WHERE id = ?', participantId);
  await recordAudit(barbecueId, user.id, 'delete', 'participant', participantId, null, null);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/participantes`);
}

// --- Despesas ---

export async function createExpenseAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    description: z.string().min(1),
    category: z.string().optional(),
    quantity: z.string().optional(),
    unit_value: z.string().optional(),
    total_value: z.string().optional(),
    purchase_date: z.string().optional(),
    paid_by_name: z.string().optional(),
    included_in_split: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const qty = data.quantity ? Number(data.quantity.replace(',', '.')) || 1 : 1;
  const unit = parseBRL(data.unit_value || '0');
  let total = parseBRL(data.total_value || '0');
  if (total === 0 && unit > 0) total = Math.round(unit * qty);

  const id = newId();
  await dbExec(
    `INSERT INTO expenses
      (id, barbecue_id, description, category, quantity, unit_value_cents, total_value_cents,
       purchase_date, paid_by_name, included_in_split, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    barbecueId,
    data.description,
    data.category || null,
    qty,
    unit,
    total,
    data.purchase_date || null,
    data.paid_by_name || null,
    data.included_in_split === 'on' || data.included_in_split === '1' || !data.included_in_split
      ? 1
      : 0,
    data.notes || null,
  );
  await recordAudit(barbecueId, user.id, 'create', 'expense', id, null, { ...data, total });
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/despesas`);
}

export async function updateExpenseAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const expenseId = String(formData.get('expense_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    description: z.string().min(1),
    category: z.string().optional(),
    quantity: z.string().optional(),
    unit_value: z.string().optional(),
    total_value: z.string().optional(),
    purchase_date: z.string().optional(),
    paid_by_name: z.string().optional(),
    included_in_split: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const qty = data.quantity ? Number(data.quantity.replace(',', '.')) || 1 : 1;
  const unit = parseBRL(data.unit_value || '0');
  let total = parseBRL(data.total_value || '0');
  if (total === 0 && unit > 0) total = Math.round(unit * qty);

  await dbExec(
    `UPDATE expenses
     SET description = ?, category = ?, quantity = ?, unit_value_cents = ?, total_value_cents = ?,
         purchase_date = ?, paid_by_name = ?, included_in_split = ?, notes = ?, updated_at = now()
     WHERE id = ? AND barbecue_id = ?`,
    data.description,
    data.category || null,
    qty,
    unit,
    total,
    data.purchase_date || null,
    data.paid_by_name || null,
    data.included_in_split === 'on' || data.included_in_split === '1' ? 1 : 0,
    data.notes || null,
    expenseId,
    barbecueId,
  );
  await recordAudit(barbecueId, user.id, 'update', 'expense', expenseId, null, { ...data, total });
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/despesas`);
}

export async function deleteExpenseAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const expenseId = String(formData.get('expense_id'));
  const { user } = await requireOwner(barbecueId);
  await dbExec('DELETE FROM expenses WHERE id = ?', expenseId);
  await recordAudit(barbecueId, user.id, 'delete', 'expense', expenseId, null, null);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/despesas`);
}

// --- Contribuições ---

export async function createContributionAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    participant_id: z.string().optional().or(z.literal('')),
    description: z.string().min(1),
    category: z.string().optional(),
    value: z.string().min(1),
    quantity: z.string().optional(),
    status: z.enum(['pendente', 'aprovada', 'rejeitada']).optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const id = newId();
  await dbExec(
    `INSERT INTO contributions
      (id, barbecue_id, participant_id, description, category, value_cents, quantity, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    barbecueId,
    data.participant_id || null,
    data.description,
    data.category || null,
    parseBRL(data.value),
    data.quantity ? Number(data.quantity.replace(',', '.')) : null,
    data.status || 'aprovada',
    data.notes || null,
  );
  await recordAudit(barbecueId, user.id, 'create', 'contribution', id, null, data);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/contribuicoes`);
}

export async function setContributionStatusAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const contributionId = String(formData.get('contribution_id'));
  const status = String(formData.get('status'));
  const { user } = await requireOwner(barbecueId);
  await dbExec('UPDATE contributions SET status = ? WHERE id = ?', status, contributionId);
  await recordAudit(barbecueId, user.id, 'update_status', 'contribution', contributionId, null, {
    status,
  });
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/contribuicoes`);
}

export async function updateContributionAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const contributionId = String(formData.get('contribution_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    participant_id: z.string().optional().or(z.literal('')),
    description: z.string().min(1),
    category: z.string().optional(),
    value: z.string().min(1),
    quantity: z.string().optional(),
    status: z.enum(['pendente', 'aprovada', 'rejeitada']).optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  await dbExec(
    `UPDATE contributions
     SET participant_id = ?, description = ?, category = ?, value_cents = ?, quantity = ?, status = ?, notes = ?, updated_at = now()
     WHERE id = ? AND barbecue_id = ?`,
    data.participant_id || null,
    data.description,
    data.category || null,
    parseBRL(data.value),
    data.quantity ? Number(data.quantity.replace(',', '.')) : null,
    data.status || 'aprovada',
    data.notes || null,
    contributionId,
    barbecueId,
  );
  await recordAudit(barbecueId, user.id, 'update', 'contribution', contributionId, null, data);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/contribuicoes`);
}

export async function deleteContributionAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const contributionId = String(formData.get('contribution_id'));
  const { user } = await requireOwner(barbecueId);
  await dbExec('DELETE FROM contributions WHERE id = ?', contributionId);
  await recordAudit(barbecueId, user.id, 'delete', 'contribution', contributionId, null, null);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/contribuicoes`);
}

// --- Pagamentos ---

export async function createPaymentAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const { user } = await requireOwner(barbecueId);
  const schema = z.object({
    participant_id: z.string().min(1),
    value: z.string().min(1),
    payment_date: z.string().optional(),
    payment_method: z.string().optional(),
    status: z.enum(['informado', 'confirmado', 'rejeitado', 'estornado']).optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));
  const id = newId();
  await dbExec(
    `INSERT INTO payments
      (id, barbecue_id, participant_id, value_cents, payment_date, payment_method, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    barbecueId,
    data.participant_id,
    parseBRL(data.value),
    data.payment_date || null,
    data.payment_method || 'pix',
    data.status || 'confirmado',
    data.notes || null,
  );
  await recordAudit(barbecueId, user.id, 'create', 'payment', id, null, data);
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/pagamentos`);
}

export async function setPaymentStatusAction(formData: FormData) {
  const barbecueId = String(formData.get('barbecue_id'));
  const paymentId = String(formData.get('payment_id'));
  const status = String(formData.get('status'));
  const { user } = await requireOwner(barbecueId);
  await dbExec('UPDATE payments SET status = ? WHERE id = ?', status, paymentId);
  await recordAudit(barbecueId, user.id, 'update_status', 'payment', paymentId, null, { status });
  revalidatePath(`/churrasco/${barbecueId}`);
  revalidatePath(`/churrasco/${barbecueId}/pagamentos`);
}

// --- Pagamento informado por participante (via link individual) ---

export async function informPaymentAction(formData: FormData) {
  const token = String(formData.get('token'));
  const method = String(formData.get('payment_method') || 'pix');
  const notes = String(formData.get('notes') || '');
  const participant = await dbGet<{ id: string; barbecue_id: string }>(
    'SELECT id, barbecue_id FROM participants WHERE access_token = ?',
    token,
  );
  if (!participant) throw new Error('Token inválido');
  const summary = await computeBarbecueSummary(participant.barbecue_id);
  const row = summary.rows.find((r) => r.participant.id === participant.id);
  const value = Math.max(0, row?.balanceCents ?? 0);
  if (value <= 0) throw new Error('Não há valor pendente para informar');
  const id = newId();
  const receiptUrl = await uploadReceipt(formData.get('receipt_file'), id);
  await dbExec(
    `INSERT INTO payments (id, barbecue_id, participant_id, value_cents, payment_method, status, notes, receipt_url)
     VALUES (?, ?, ?, ?, ?, 'informado', ?, ?)`,
    id,
    participant.barbecue_id,
    participant.id,
    value,
    method,
    notes || null,
    receiptUrl || null,
  );
  await recordAudit(participant.barbecue_id, null, 'inform_payment', 'payment', id, null, {
    value,
    method,
  });
  revalidatePath(`/p/${token}`);
}
