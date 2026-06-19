import { notFound } from 'next/navigation';
import { computeBarbecueSummary, getBarbecueByShareToken, listExpenses } from '@/lib/queries';
import { formatBRL } from '@/lib/money';

export default async function PublicBarbecuePage({ params }: { params: { token: string } }) {
  const b = await getBarbecueByShareToken(params.token);
  if (!b) notFound();
  const [expenses, summary] = await Promise.all([
    listExpenses(b.id),
    computeBarbecueSummary(b.id),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="card">
        <div className="text-xs uppercase text-coal-700">Churrasco</div>
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <p className="text-sm text-coal-700">
          {[b.theme, b.event_date, b.event_time, b.location].filter(Boolean).join(' · ') || 'Sem detalhes'}
        </p>
        {b.notes && <p className="mt-2 text-sm">{b.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card"><div className="text-[10px] uppercase text-coal-700">Total despesas</div><div className="money text-xl">{formatBRL(summary.totalExpensesCents)}</div></div>
        <div className="card"><div className="text-[10px] uppercase text-coal-700">Participantes</div><div className="money text-xl">{summary.participantCount}</div></div>
      </div>

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

      <p className="text-xs text-coal-700 text-center">
        Para ver sua parte e pagar, use o link individual que o organizador enviou.
      </p>
    </div>
  );
}
