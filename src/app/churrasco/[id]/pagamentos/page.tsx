import { notFound } from 'next/navigation';
import { computeBarbecueSummary, getBarbecue, listParticipants, listPayments } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { formatDateBR } from '@/lib/date';
import { createPaymentAction, setPaymentStatusAction } from '@/lib/actions';
import SubmitButton from '@/app/SubmitButton';

export default async function PagamentosPage({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const [participants, payments, summary] = await Promise.all([
    listParticipants(b.id),
    listPayments(b.id),
    computeBarbecueSummary(b.id),
  ]);
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-bold mb-3">Registrar pagamento</h2>
        <form action={createPaymentAction} className="grid sm:grid-cols-3 gap-3">
          <input type="hidden" name="barbecue_id" value={b.id} />
          <div>
            <label className="label">Participante *</label>
            <select className="input" name="participant_id" required>
              <option value="">Selecionar…</option>
              {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="label">Valor (R$) *</label><input className="input" name="value" required inputMode="decimal" placeholder="0,00" /></div>
          <div><label className="label">Data</label><input className="input" name="payment_date" type="date" /></div>
          <div>
            <label className="label">Forma</label>
            <select className="input" name="payment_method" defaultValue="pix">
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
              <option value="cartao">Cartão</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue="confirmado">
              <option value="informado">Informado</option>
              <option value="confirmado">Confirmado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="estornado">Estornado</option>
            </select>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <SubmitButton label="Registrar" />
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Pagamentos</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum pagamento registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Participante</th><th>Data</th><th>Forma</th><th className="text-right">Valor</th><th>Comprovante</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{nameById.get(p.participant_id) || '—'}</td>
                    <td>{formatDateBR(p.payment_date)}</td>
                    <td>{p.payment_method || '—'}</td>
                    <td className="text-right money">{formatBRL(p.value_cents)}</td>
                    <td>{p.receipt_url ? <a className="text-ember-700 hover:underline" href={p.receipt_url} target="_blank">Abrir</a> : '—'}</td>
                    <td>
                      <form action={setPaymentStatusAction} className="flex gap-1 flex-wrap">
                        <input type="hidden" name="barbecue_id" value={b.id} />
                        <input type="hidden" name="payment_id" value={p.id} />
                        {['informado', 'confirmado', 'rejeitado', 'estornado'].map((s) => (
                          <button
                            key={s}
                            name="status"
                            value={s}
                            className={`pill ${p.status === s ? 'bg-ember-600 text-white' : 'bg-coal-100 text-coal-800'}`}
                            type="submit"
                          >
                            {s}
                          </button>
                        ))}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Saldo por participante</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Participante</th><th className="text-right">Devido</th><th className="text-right">Pago</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.participant.id}>
                  <td>{r.participant.name}</td>
                  <td className="text-right money">{formatBRL(r.amountDueCents)}</td>
                  <td className="text-right money">{formatBRL(r.paidCents)}</td>
                  <td className={`text-right money ${r.balanceCents > 0 ? 'text-ember-700' : r.balanceCents < 0 ? 'text-green-700' : ''}`}>
                    {formatBRL(r.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
