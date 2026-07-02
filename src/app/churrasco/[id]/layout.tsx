import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getBarbecue } from '@/lib/queries';
import { formatDateBR } from '@/lib/date';
import { updateBarbecueAction } from '@/lib/actions';
import SubmitButton from '@/app/SubmitButton';

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
            {[b.theme, formatDateBR(b.event_date), b.event_time, b.location].filter((v) => v && v !== '—').join(' · ') || 'Sem detalhes'}
          </p>
        </div>
        <details className="w-full sm:w-auto sm:text-right">
          <summary className="btn-secondary cursor-pointer inline-flex">Editar dados</summary>
          <form action={updateBarbecueAction} className="card mt-3 grid sm:grid-cols-2 gap-3 text-left">
            <input type="hidden" name="id" value={b.id} />
            <div className="sm:col-span-2"><label className="label">Nome *</label><input className="input" name="name" defaultValue={b.name} required /></div>
            <div><label className="label">Tema</label><input className="input" name="theme" defaultValue={b.theme ?? ''} /></div>
            <div><label className="label">Local</label><input className="input" name="location" defaultValue={b.location ?? ''} /></div>
            <div><label className="label">Data</label><input className="input" name="event_date" type="date" defaultValue={b.event_date ?? ''} /></div>
            <div><label className="label">Horário</label><input className="input" name="event_time" type="time" defaultValue={b.event_time ?? ''} /></div>
            <div><label className="label">Chave Pix</label><input className="input" name="pix_key" defaultValue={b.pix_key ?? ''} /></div>
            <div><label className="label">Nome de quem recebe o Pix</label><input className="input" name="pix_receiver_name" defaultValue={b.pix_receiver_name ?? ''} /></div>
            <div>
              <label className="label">Tipo da chave Pix</label>
              <select className="input" name="pix_key_type" defaultValue={b.pix_key_type ?? ''}>
                <option value="">—</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Aleatória</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className="label">Descrição</label><textarea className="input" name="description" rows={2} defaultValue={b.description ?? ''} /></div>
            <div className="sm:col-span-2"><label className="label">Observações</label><textarea className="input" name="notes" rows={2} defaultValue={b.notes ?? ''} /></div>
            <div className="sm:col-span-2 flex justify-end"><SubmitButton label="Salvar dados" /></div>
          </form>
        </details>
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
