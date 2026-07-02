import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { listParticipantsForOwner } from '@/lib/queries';
import { formatDateBR } from '@/lib/date';

export default async function ParticipantesHistoricoPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const participants = await listParticipantsForOwner(user.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-coal-700 hover:underline">← Meus churrascos</Link>
          <h1 className="text-2xl font-bold">Participantes dos churras</h1>
          <p className="text-sm text-coal-700">Histórico de pessoas que já participaram dos seus churrascos.</p>
        </div>
      </div>

      <div className="card">
        {participants.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhum participante cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Nome</th><th>Contato</th><th>Churrasco</th><th>Data</th><th>Link</th></tr></thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.phone ? <a className="text-ember-700 hover:underline" href={`https://wa.me/${p.phone}`} target="_blank">+{p.phone}</a> : p.email || '—'}</td>
                    <td>{p.barbecue_name}</td>
                    <td>{formatDateBR(p.event_date)}</td>
                    <td><Link className="text-ember-700 hover:underline" href={`/churrasco/${p.barbecue_id}/participantes`}>Abrir churrasco</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
