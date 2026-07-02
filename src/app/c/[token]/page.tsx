import { notFound } from 'next/navigation';
import Link from 'next/link';
import { computeBarbecueSummary, getBarbecueByShareToken, listContributions, listExpenses, listParticipants } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { formatDateBR } from '@/lib/date';

export default async function PublicBarbecuePage({ params }: { params: { token: string } }) {
  const b = await getBarbecueByShareToken(params.token);
  if (!b) notFound();
  const [expenses, participants, summary, allContribs] = await Promise.all([
    listExpenses(b.id),
    listParticipants(b.id),
    computeBarbecueSummary(b.id),
    listContributions(b.id),
  ]);
  const leftovers = allContribs.filter((c) => c.participant_id === null && c.status === 'aprovada');
  const participantContribs = allContribs.filter((c) => c.participant_id !== null && c.status === 'aprovada');
  const participantNameById = new Map(participants.map((p) => [p.id, p.name]));
  const leftoverAdjustments = new Map<string, number>();

  if (summary.totalLeftoversCents > 0) {
    const splitRows = summary.rows.filter((r) => r.participant.participates_in_split);
    const organizerRows = splitRows.filter((r) => r.participant.is_organizer);
    const nonOrganizerRows = splitRows.filter((r) => !r.participant.is_organizer);

    if (organizerRows.length > 0 && nonOrganizerRows.length > 0) {
      const discountBase = Math.floor(summary.totalLeftoversCents / nonOrganizerRows.length);
      const discountRemainder = summary.totalLeftoversCents - discountBase * nonOrganizerRows.length;
      for (const [index, row] of nonOrganizerRows.entries()) {
        leftoverAdjustments.set(row.participant.id, -(discountBase + (index < discountRemainder ? 1 : 0)));
      }

      const organizerBase = Math.floor(summary.totalLeftoversCents / organizerRows.length);
      const organizerRemainder = summary.totalLeftoversCents - organizerBase * organizerRows.length;
      for (const [index, row] of organizerRows.entries()) {
        leftoverAdjustments.set(row.participant.id, organizerBase + (index < organizerRemainder ? 1 : 0));
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="card">
        <div className="text-xs uppercase text-coal-700">Churrasco</div>
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <p className="text-sm text-coal-700">
          {[b.theme, formatDateBR(b.event_date), b.event_time, b.location].filter((v) => v && v !== '—').join(' · ') || 'Sem detalhes'}
        </p>
        {b.notes && <p className="mt-2 text-sm">{b.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card"><div className="text-[10px] uppercase text-coal-700">Total despesas</div><div className="money text-xl">{formatBRL(summary.totalExpensesCents)}</div></div>
        <div className="card"><div className="text-[10px] uppercase text-coal-700">Participantes</div><div className="money text-xl">{summary.participantCount}</div></div>
        {summary.totalLeftoversCents > 0 && (
          <div className="card"><div className="text-[10px] uppercase text-coal-700">Sobras (-)</div><div className="money text-xl text-ember-700">{formatBRL(summary.totalLeftoversCents)}</div></div>
        )}
        <div className="card"><div className="text-[10px] uppercase text-coal-700">Total a ratear</div><div className="money text-xl text-ember-700">{formatBRL(summary.totalSplitCents)}</div></div>
      </div>

      {leftovers.length > 0 && (
        <div className="card bg-ember-50/40 border-ember-300">
          <h2 className="font-bold mb-2">O que sobrou 🍖</h2>
          <p className="text-xs text-coal-700 mb-3">O organizador ficou com estes itens. O valor foi cobrado dele e virou desconto para os demais participantes.</p>
          <ul className="text-sm divide-y divide-coal-100">
            {leftovers.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-3">
                <span>{c.description} <em className="text-xs text-coal-700">({c.category || 'Outros'}){c.quantity ? ` · ${String(c.quantity).replace('.', ',')}x` : ''}</em></span>
                <span className="money text-ember-700">{formatBRL(c.value_cents)}</span>
              </li>
            ))}
            <li className="py-2 flex justify-between font-semibold">
              <span>Total das sobras</span>
              <span className="money text-ember-700">{formatBRL(summary.totalLeftoversCents)}</span>
            </li>
            {summary.splitParticipantCount > 1 && (
              <li className="py-2 flex justify-between text-coal-700">
                <span>Desconto médio para quem não ficou com a sobra</span>
                <span className="money">{formatBRL(Math.floor(summary.totalLeftoversCents / Math.max(1, summary.splitParticipantCount - 1)))}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-3">Despesas do churrasco</h2>
        <ul className="text-sm divide-y divide-coal-100">
          {expenses.map((e) => (
            <li key={e.id} className="py-2 flex justify-between gap-3">
              <span>{e.description} <em className="text-xs text-coal-700">({e.category || 'Outros'})</em></span>
              <span className="money">{formatBRL(e.total_value_cents)}</span>
            </li>
          ))}
        </ul>
      </div>

      {participantContribs.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">Quem levou algo</h2>
          <p className="text-xs text-coal-700 mb-3">Esses itens reduzem o valor de quem trouxe, por isso algumas pessoas pagam menos.</p>
          <ul className="text-sm divide-y divide-coal-100">
            {participantContribs.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-3">
                <span>
                  <strong>{participantNameById.get(c.participant_id!) || 'Participante'}</strong> levou {c.description}
                  <em className="text-xs text-coal-700"> ({c.category || 'Outros'}){c.quantity ? ` · ${String(c.quantity).replace('.', ',')}x` : ''}</em>
                </span>
                <span className="money text-ember-700">-{formatBRL(c.value_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-3">Quem paga quanto</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum participante cadastrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {summary.rows.map((r) => {
              const paid = r.paidCents >= r.amountDueCents && r.amountDueCents > 0;
              const leftoverAdjustment = leftoverAdjustments.get(r.participant.id) ?? 0;
              return (
                <Link
                  key={r.participant.id}
                  href={`/p/${r.participant.access_token}`}
                  className={`card flex flex-col items-center text-center gap-1 hover:border-ember-300 transition ${paid ? 'opacity-60' : ''}`}
                >
                  <div className="text-2xl">{r.participant.is_organizer ? '🎩' : '🍖'}</div>
                  <div className="font-semibold text-sm">{r.participant.name}</div>
                  <div className={`money ${r.balanceCents > 0 ? 'text-ember-700' : 'text-green-700'}`}>
                    {formatBRL(Math.max(0, r.balanceCents))}
                  </div>
                  {r.contributionCents > 0 && <span className="text-[10px] text-green-700">levou -{formatBRL(r.contributionCents)}</span>}
                  {leftoverAdjustment < 0 && <span className="text-[10px] text-green-700">sobra -{formatBRL(Math.abs(leftoverAdjustment))}</span>}
                  {leftoverAdjustment > 0 && <span className="text-[10px] text-coal-700">ficou com sobra +{formatBRL(leftoverAdjustment)}</span>}
                  {paid && <span className="pill bg-green-100 text-green-800">Pago</span>}
                  {r.balanceCents < 0 && <span className="pill bg-blue-100 text-blue-800">Crédito</span>}
                  <span className="text-[10px] text-coal-700">tocar para pagar</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-coal-700 text-center">
        Toque no seu nome para ver detalhes e informar o pagamento.
      </p>
    </div>
  );
}
