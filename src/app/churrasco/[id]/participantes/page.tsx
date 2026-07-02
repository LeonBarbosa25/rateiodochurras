import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { formatDateBR } from '@/lib/date';
import {
  computeBarbecueSummary,
  getBarbecue,
  listParticipants,
  listReusableParticipantsForBarbecue,
} from '@/lib/queries';
import {
  addParticipantsFromHistoryAction,
  createParticipantAction,
  deleteParticipantAction,
  updateParticipantAction,
  updateParticipantSplitAction,
} from '@/lib/actions';
import { formatBRL } from '@/lib/money';
import SubmitButton from '@/app/SubmitButton';
import ConfirmDelete from '@/app/ConfirmDelete';

export default async function ParticipantesPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  const b = await getBarbecue(params.id);
  if (!user || !b) notFound();
  const [participants, summary, reusableParticipants] = await Promise.all([
    listParticipants(b.id),
    computeBarbecueSummary(b.id),
    listReusableParticipantsForBarbecue(user.id, b.id),
  ]);
  const rowsById = new Map(summary.rows.map((r) => [r.participant.id, r]));

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-bold mb-3">Novo participante</h2>
        <form action={createParticipantAction} className="grid sm:grid-cols-3 gap-3">
          <input type="hidden" name="barbecue_id" value={b.id} />
          <div><label className="label">Nome *</label><input className="input" name="name" required /></div>
          <div><label className="label">Telefone</label><input className="input" name="phone" /></div>
          <div><label className="label">E-mail</label><input className="input" name="email" type="email" /></div>
          <div className="sm:col-span-3 flex flex-wrap items-end gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="participates_in_split" defaultChecked /> Participa do rateio
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_organizer" /> É organizador
            </label>
            <div className="flex-1" />
            <SubmitButton label="Adicionar" />
          </div>
        </form>
      </div>

      {reusableParticipants.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-1">Adicionar de outros churras</h2>
          <p className="text-sm text-coal-700 mb-3">
            Selecione participantes antigos para criar novos acessos neste churrasco.
          </p>
          <form action={addParticipantsFromHistoryAction} className="space-y-3">
            <input type="hidden" name="barbecue_id" value={b.id} />
            <div className="grid md:grid-cols-2 gap-2">
              {reusableParticipants.map((p) => {
                const digits = normalizeWhatsAppPhone(p.phone);
                const contact = p.email || (digits ? `+${digits}` : 'Sem contato');
                return (
                  <label
                    key={p.id}
                    className="flex items-start gap-3 rounded-xl border border-coal-100 p-3 text-sm hover:bg-ember-50/50"
                  >
                    <input
                      type="checkbox"
                      name="participant_ids"
                      value={p.id}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-coal-900">{p.name}</span>
                      <span className="block text-xs text-coal-700">{contact}</span>
                      <span className="block text-xs text-coal-700">
                        {p.barbecue_name}
                        {p.event_date ? ` · ${formatDateBR(p.event_date)}` : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end">
              <SubmitButton label="Adicionar selecionados" />
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-3">Participantes ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum participante cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th><th>Contato</th><th>No rateio</th>
                  <th className="text-right">Contribuição</th>
                  <th className="text-right">Devido</th>
                  <th className="text-right">Pago</th>
                  <th className="text-right">Saldo</th>
                  <th>Link</th><th></th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const r = rowsById.get(p.id);
                  const digits = normalizeWhatsAppPhone(p.phone);
                  const phone = digits ? `+${digits}` : '';
                  const whatsapp = digits ? `https://api.whatsapp.com/send?phone=${digits}` : '';
                  return (
                    <tr key={p.id}>
                      <td colSpan={9}>
                        <div className="space-y-3">
                          <div className="grid md:grid-cols-7 gap-2 items-center">
                            <span className="font-medium">{p.name}{p.is_organizer ? ' 🎩' : ''}</span>
                            <span className="text-xs">{p.email || phone || '—'}</span>
                            <span>{p.participates_in_split ? 'No rateio' : 'Fora do rateio'}</span>
                            <span className="money text-right">{formatBRL(r?.contributionCents ?? 0)}</span>
                            <span className="money text-right">{formatBRL(r?.amountDueCents ?? 0)}</span>
                            <span className="money text-right">{formatBRL(r?.paidCents ?? 0)}</span>
                            <span className="money text-right text-ember-700">{formatBRL(r?.balanceCents ?? 0)}</span>
                          </div>
                          <div className="flex flex-wrap items-start justify-end gap-2 text-xs text-coal-700">
                            {whatsapp && <Link className="text-ember-700 hover:underline py-2.5" href={whatsapp} target="_blank">WhatsApp</Link>}
                            <Link className="text-ember-700 hover:underline py-2.5" href={`/p/${p.access_token}`} target="_blank">Abrir ambiente individual</Link>
                            <form action={updateParticipantSplitAction} className="inline">
                              <input type="hidden" name="barbecue_id" value={b.id} />
                              <input type="hidden" name="participant_id" value={p.id} />
                              <input type="hidden" name="value" value={p.participates_in_split ? '0' : '1'} />
                              <button className="btn-ghost" type="submit">{p.participates_in_split ? 'Tirar do rateio' : 'Colocar no rateio'}</button>
                            </form>
                            <details className="contents">
                              <summary className="btn-ghost cursor-pointer inline-flex">Editar</summary>
                              <form action={updateParticipantAction} className="order-last grid basis-full md:grid-cols-6 gap-2 items-end mt-3 border-t border-coal-100 pt-3 text-left">
                                <input type="hidden" name="barbecue_id" value={b.id} />
                                <input type="hidden" name="participant_id" value={p.id} />
                                <div>
                                  <label className="label">Nome</label>
                                  <input className="input" name="name" defaultValue={p.name} required />
                                </div>
                                <div>
                                  <label className="label">WhatsApp</label>
                                  <input className="input" name="phone" defaultValue={phone} placeholder="(11) 99999-9999" />
                                </div>
                                <div>
                                  <label className="label">E-mail</label>
                                  <input className="input" name="email" type="email" defaultValue={p.email ?? ''} />
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm pb-2">
                                  <input type="checkbox" name="participates_in_split" defaultChecked={Boolean(p.participates_in_split)} /> Rateio
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm pb-2">
                                  <input type="checkbox" name="is_organizer" defaultChecked={Boolean(p.is_organizer)} /> Organizador
                                </label>
                                <div className="flex gap-2 justify-end">
                                  <SubmitButton label="Salvar" />
                                </div>
                              </form>
                            </details>
                            <ConfirmDelete formAction={deleteParticipantAction} label="Remover" message="Remover este participante?">
                              <input type="hidden" name="barbecue_id" value={b.id} />
                              <input type="hidden" name="participant_id" value={p.id} />
                            </ConfirmDelete>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeWhatsAppPhone(phone: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
