import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { computeBarbecueSummary, listBarbecuesForOwner } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { formatDateBR } from '@/lib/date';

export default async function HomePage({ searchParams }: { searchParams: { filtro?: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const filtro = searchParams.filtro || 'todos';
  let churrascos = await listBarbecuesForOwner(user.id);
  const today = new Date().toISOString().slice(0, 10);
  if (filtro === 'proximos') {
    churrascos = churrascos.filter((c) => (c.event_date ?? '') >= today && c.status !== 'cancelado');
  } else if (filtro === 'anteriores') {
    churrascos = churrascos.filter((c) => (c.event_date ?? '') < today);
  } else if (filtro === 'aberto') {
    churrascos = churrascos.filter((c) => c.status === 'aberto' || c.status === 'rascunho');
  } else if (filtro === 'finalizados') {
    churrascos = churrascos.filter((c) => c.status === 'finalizado' || c.status === 'rateio_fechado');
  } else if (filtro === 'cancelados') {
    churrascos = churrascos.filter((c) => c.status === 'cancelado');
  }

  const summaries = await Promise.all(churrascos.map((c) => computeBarbecueSummary(c.id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meus churrascos</h1>
          <p className="text-coal-700 text-sm">Olá, {user.name}. Vamos rachar a conta?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/participantes" className="btn-secondary">Participantes</Link>
          <Link href="/churrasco/new" className="btn-primary">+ Criar churrasco</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          ['todos', 'Todos'],
          ['proximos', 'Próximos'],
          ['anteriores', 'Anteriores'],
          ['aberto', 'Em aberto'],
          ['finalizados', 'Finalizados'],
          ['cancelados', 'Cancelados'],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={`/?filtro=${k}`}
            className={`pill ${filtro === k ? 'bg-ember-600 text-white' : 'bg-ember-50 text-ember-800'}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {churrascos.length === 0 ? (
        <div className="card text-center">
          <p className="text-coal-700">Você ainda não criou nenhum churrasco.</p>
          <Link href="/churrasco/new" className="btn-primary mt-4">Criar o primeiro</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {churrascos.map((c, i) => {
            const s = summaries[i];
            return (
              <Link key={c.id} href={`/churrasco/${c.id}`} className="card hover:border-ember-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <p className="text-xs text-coal-700">{c.theme || 'Sem tema'}</p>
                  </div>
                  <span className={`pill ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                  <Info label="Data" value={formatDateBR(c.event_date)} />
                  <Info label="Participantes" value={String(s.participantCount)} />
                  <Info label="Total despesas" value={formatBRL(s.totalExpensesCents)} />
                  <Info label="Recebido" value={formatBRL(s.totalPaidCents)} />
                  <Info label="Pendente" value={formatBRL(s.totalPendingCents)} highlight />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-coal-700 tracking-wide">{label}</div>
      <div className={`money ${highlight ? 'text-ember-700' : ''}`}>{value}</div>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    { rascunho: 'Rascunho', aberto: 'Aberto', rateio_fechado: 'Rateio fechado', finalizado: 'Finalizado', cancelado: 'Cancelado' } as Record<string, string>
  )[s] || s;
}
function statusColor(s: string) {
  return (
    {
      rascunho: 'bg-coal-100 text-coal-800',
      aberto: 'bg-ember-100 text-ember-800',
      rateio_fechado: 'bg-blue-100 text-blue-800',
      finalizado: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800',
    } as Record<string, string>
  )[s] || 'bg-coal-100 text-coal-800';
}
