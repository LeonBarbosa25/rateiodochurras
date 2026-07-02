import { notFound } from 'next/navigation';
import {
  computeBarbecueSummary,
  getBarbecue,
  getParticipantByToken,
  listContributions,
  listPayments,
} from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { informPaymentAction } from '@/lib/actions';
import { formatDateBR } from '@/lib/date';
import SubmitButton from '@/app/SubmitButton';
import CopyButton from '@/app/churrasco/[id]/compartilhar/CopyButton';

export default async function ParticipantePage({ params }: { params: { token: string } }) {
  const participant = await getParticipantByToken(params.token);
  if (!participant) notFound();
  const b = await getBarbecue(participant.barbecue_id);
  if (!b) notFound();
  const [summary, allContribs, allPayments] = await Promise.all([
    computeBarbecueSummary(b.id),
    listContributions(b.id),
    listPayments(b.id),
  ]);
  const me = summary.rows.find((r) => r.participant.id === participant.id);
  const myContribs = allContribs.filter((c) => c.participant_id === participant.id);
  const myPayments = allPayments.filter((p) => p.participant_id === participant.id);

  const baseCents = summary.baseValueCents;
  const contribCents = me?.contributionCents ?? 0;
  const dueCents = me?.amountDueCents ?? 0;
  const paidCents = me?.paidCents ?? 0;
  const balanceCents = me?.balanceCents ?? 0;
  const splitRows = summary.rows.filter((r) => r.participant.participates_in_split);
  const organizerRows = splitRows.filter((r) => r.participant.is_organizer);
  const nonOrganizerRows = splitRows.filter((r) => !r.participant.is_organizer);
  let leftoverAdjustmentCents = 0;
  if (summary.totalLeftoversCents > 0 && organizerRows.length > 0 && nonOrganizerRows.length > 0) {
    if (participant.is_organizer) {
      const base = Math.floor(summary.totalLeftoversCents / organizerRows.length);
      const remainder = summary.totalLeftoversCents - base * organizerRows.length;
      const organizerIndex = organizerRows.findIndex((r) => r.participant.id === participant.id);
      leftoverAdjustmentCents = base + (organizerIndex >= 0 && organizerIndex < remainder ? 1 : 0);
    } else {
      const base = Math.floor(summary.totalLeftoversCents / nonOrganizerRows.length);
      const remainder = summary.totalLeftoversCents - base * nonOrganizerRows.length;
      const participantIndex = nonOrganizerRows.findIndex((r) => r.participant.id === participant.id);
      leftoverAdjustmentCents = -(base + (participantIndex >= 0 && participantIndex < remainder ? 1 : 0));
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="card">
        <div className="text-xs uppercase text-coal-700 tracking-wide">Churrasco</div>
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <p className="text-sm text-coal-700">
          {[b.theme, formatDateBR(b.event_date), b.event_time, b.location].filter((v) => v && v !== '—').join(' · ') || 'Sem detalhes'}
        </p>
        <p className="mt-3 text-sm">Olá, <strong>{participant.name}</strong>!</p>
      </div>

      <div className="card bg-ember-50/40 border-ember-300">
        <div className="text-xs uppercase text-ember-800 tracking-wide">Você precisa pagar</div>
        <div className="text-4xl font-bold text-ember-700 money mt-1">{formatBRL(Math.max(0, balanceCents))}</div>
        <div className="mt-3 text-sm text-coal-700 space-y-1">
          <div>Sua parte no rateio: <span className="money">{formatBRL(baseCents)}</span></div>
          <div>Desconto pelas suas contribuições: <span className="money">{formatBRL(Math.min(baseCents, contribCents))}</span></div>
          {leftoverAdjustmentCents < 0 && (
            <div>Desconto pelas sobras: <span className="money">{formatBRL(Math.abs(leftoverAdjustmentCents))}</span></div>
          )}
          {leftoverAdjustmentCents > 0 && (
            <div>Sobras que ficaram com você: <span className="money">+{formatBRL(leftoverAdjustmentCents)}</span></div>
          )}
          <div>Valor final a pagar: <span className="money">{formatBRL(dueCents)}</span></div>
          <div>Já pago: <span className="money">{formatBRL(paidCents)}</span></div>
        </div>
      </div>

      {b.pix_key && (
        <div className="card">
          <h2 className="font-bold mb-2">Pagar com Pix</h2>
          {b.pix_receiver_name && (
            <p className="text-sm mb-2">Recebedor: <strong>{b.pix_receiver_name}</strong></p>
          )}
          <div className="text-sm">
            <div className="text-xs uppercase text-coal-700">Chave Pix ({b.pix_key_type || 'tipo não informado'})</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="font-mono text-base bg-coal-100 rounded-xl px-3 py-2 break-all flex-1">{b.pix_key}</div>
              <CopyButton text={b.pix_key} label="Copiar" small />
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-3">Informar que paguei</h2>
        <form action={informPaymentAction} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="token" value={participant.access_token} />
          <div>
            <label className="label">Valor final</label>
            <div className="input bg-coal-100 money">{formatBRL(Math.max(0, balanceCents))}</div>
            <p className="text-xs text-coal-700 mt-1">O valor é calculado pelo sistema e não pode ser alterado.</p>
          </div>
          <div>
            <label className="label">Forma</label>
            <select className="input" name="payment_method" defaultValue="pix">
              <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="cartao">Cartão</option><option value="outro">Outro</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Comprovante</label>
            <input className="input" name="receipt_file" type="file" accept="image/*,.pdf,application/pdf" />
            <p className="text-xs text-coal-700 mt-1">Envie PDF, JPG, PNG ou print do celular. Tamanho máximo: 8 MB.</p>
          </div>
          <div className="sm:col-span-2"><label className="label">Observação</label><input className="input" name="notes" placeholder="Ex.: paguei agora à tarde" /></div>
          <div className="sm:col-span-2 flex justify-end"><SubmitButton label="Enviar para o organizador confirmar" /></div>
        </form>
      </div>

      <div className="card">
        <h2 className="font-bold mb-2">Histórico de pagamentos</h2>
        {myPayments.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum pagamento ainda.</p>
        ) : (
          <ul className="text-sm divide-y divide-coal-100">
            {myPayments.map((p) => (
              <li key={p.id} className="py-2 flex justify-between">
                <span>{formatDateBR(p.payment_date)} · {p.payment_method || '—'} · <em>{p.status}</em>{p.receipt_url ? ' · comprovante enviado' : ''}</span>
                <span className="money">{formatBRL(p.value_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {myContribs.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-2">Minhas contribuições</h2>
          <ul className="text-sm divide-y divide-coal-100">
            {myContribs.map((c) => (
              <li key={c.id} className="py-2 flex justify-between">
                <span>{c.description} <em className="text-xs">({c.status})</em></span>
                <span className="money">{formatBRL(c.value_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-2">Como o cálculo funciona</h2>
        <p className="text-sm text-coal-700">
          O total das despesas é dividido igualmente entre todos os participantes do rateio.
          Contribuições aprovadas reduzem o valor de quem trouxe e são redistribuídas entre os demais.
          Itens que sobraram são pagos pelo organizador e geram desconto para os demais.
          Ninguém fica com cobrança negativa.
        </p>
      </div>
    </div>
  );
}
