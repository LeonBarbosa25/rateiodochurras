import { computeBarbecueSummary, getBarbecue } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { deleteBarbecueAction, updateBarbecueStatusAction } from '@/lib/actions';
import { notFound } from 'next/navigation';
import ConfirmDelete from '@/app/ConfirmDelete';

export default async function BarbecuePanel({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const s = await computeBarbecueSummary(b.id);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total das despesas" value={formatBRL(s.totalExpensesCents)} />
        <Card label="Contribuições" value={formatBRL(s.totalContributionsCents)} />
        <Card label="Sobras (no organizador)" value={formatBRL(s.totalLeftoversCents)} tone="warn" />
        <Card label="Recebido" value={formatBRL(s.totalPaidCents)} tone="ok" />
        <Card label="Pendente" value={formatBRL(s.totalPendingCents)} tone="warn" />
        <Card label="Participantes" value={String(s.participantCount)} small />
        <Card label="No rateio" value={String(s.splitParticipantCount)} small />
        <Card label="Valor-base" value={formatBRL(s.baseValueCents)} small />
        <Card label="Status" value={statusLabel(b.status)} small />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Resumo do rateio</h2>
        </div>
        {s.rows.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum participante cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>No rateio</th>
                  <th className="text-right">Contribuição</th>
                  <th className="text-right">Devido</th>
                  <th className="text-right">Pago</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.participant.id}>
                    <td>{r.participant.name}</td>
                    <td>{r.participant.participates_in_split ? 'Sim' : 'Não'}</td>
                    <td className="text-right money">{formatBRL(r.contributionCents)}</td>
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
        )}
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Status e ações</h2>
        <div className="flex flex-wrap items-center gap-2">
          {['rascunho', 'aberto', 'rateio_fechado', 'finalizado', 'cancelado'].map((st) => (
            <form key={st} action={updateBarbecueStatusAction}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="status" value={st} />
              <button
                className={`pill ${b.status === st ? 'bg-ember-600 text-white' : 'bg-coal-100 text-coal-800 hover:bg-ember-100'}`}
                type="submit"
              >
                {statusLabel(st)}
              </button>
            </form>
          ))}
          <div className="ml-auto">
          <ConfirmDelete formAction={deleteBarbecueAction} label="Excluir churrasco" message="⚠️ Excluir o churrasco apaga participantes, despesas, contribuições e pagamentos. Confirmar exclusão?" className="btn-danger">
            <input type="hidden" name="id" value={b.id} />
          </ConfirmDelete>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone, small }: { label: string; value: string; tone?: 'ok' | 'warn'; small?: boolean }) {
  const color = tone === 'ok' ? 'text-green-700' : tone === 'warn' ? 'text-ember-700' : '';
  return (
    <div className="card">
      <div className="text-[10px] uppercase tracking-wide text-coal-700">{label}</div>
      <div className={`mt-1 money ${small ? 'text-lg' : 'text-2xl'} ${color}`}>{value}</div>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    { rascunho: 'Rascunho', aberto: 'Aberto', rateio_fechado: 'Rateio fechado', finalizado: 'Finalizado', cancelado: 'Cancelado' } as Record<string, string>
  )[s] || s;
}
