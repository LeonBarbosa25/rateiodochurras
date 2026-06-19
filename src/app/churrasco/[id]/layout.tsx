import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getBarbecue } from '@/lib/queries';

export default async function BarbecueLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  if (b.owner_id !== user.id) redirect('/');

  const tabs = [
    ['', 'Painel'],
    ['/despesas', 'Despesas'],
    ['/participantes', 'Participantes'],
    ['/contribuicoes', 'Contribuições'],
    ['/pagamentos', 'Pagamentos'],
    ['/compartilhar', 'Compartilhar'],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-coal-700 hover:underline">← Meus churrascos</Link>
          <h1 className="text-2xl font-bold">{b.name}</h1>
          <p className="text-sm text-coal-700">
            {[b.theme, b.event_date, b.event_time, b.location].filter(Boolean).join(' · ') || 'Sem detalhes'}
          </p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-coal-100 -mb-px overflow-x-auto">
        {tabs.map(([path, label]) => (
          <Link
            key={path}
            href={`/churrasco/${b.id}${path}`}
            className="px-3 py-2 text-sm font-medium text-coal-700 hover:text-ember-700 border-b-2 border-transparent hover:border-ember-300 whitespace-nowrap"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
