import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeBarbecueSummary, getBarbecue, listParticipants } from '@/lib/queries';
import {
  createParticipantAction,
  deleteParticipantAction,
  updateParticipantSplitAction,
} from '@/lib/actions';
import { formatBRL } from '@/lib/money';

export default async function ParticipantesPage({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const [participants, summary] = await Promise.all([
    listParticipants(b.id),
    computeBarbecueSummary(b.id),
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
            <button className="btn-primary" type="submit">Adicionar</button>
          </div>
        </form>
      </div>

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
                  return (
                    <tr key={p.id}>
                      <td>{p.name}{p.is_organizer ? ' 🎩' : ''}</td>
                      <td className="text-xs">{p.email || p.phone || '—'}</td>
                      <td>
                        <form action={updateParticipantSplitAction} className="inline">
                          <input type="hidden" name="barbecue_id" value={b.id} />
                          <input type="hidden" name="participant_id" value={p.id} />
                          <input type="hidden" name="value" value={p.participates_in_split ? '0' : '1'} />
                          <button className={`pill ${p.participates_in_split ? 'bg-ember-100 text-ember-800' : 'bg-coal-100 text-coal-800'}`} type="submit">
                            {p.participates_in_split ? 'Sim' : 'Não'}
                          </button>
                        </form>
                      </td>
                      <td className="text-right money">{formatBRL(r?.contributionCents ?? 0)}</td>
                      <td className="text-right money">{formatBRL(r?.amountDueCents ?? 0)}</td>
                      <td className="text-right money">{formatBRL(r?.paidCents ?? 0)}</td>
                      <td className="text-right money">{formatBRL(r?.balanceCents ?? 0)}</td>
                      <td>
                        <Link className="text-xs text-ember-700 hover:underline" href={`/p/${p.access_token}`} target="_blank">Abrir</Link>
                      </td>
                      <td>
                        <form action={deleteParticipantAction}>
                          <input type="hidden" name="barbecue_id" value={b.id} />
                          <input type="hidden" name="participant_id" value={p.id} />
                          <button className="btn-ghost text-red-700" type="submit">Remover</button>
                        </form>
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
