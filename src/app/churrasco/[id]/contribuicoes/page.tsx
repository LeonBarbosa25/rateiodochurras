import { notFound } from 'next/navigation';
import { getBarbecue, listContributions, listParticipants } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import {
  createContributionAction,
  deleteContributionAction,
  setContributionStatusAction,
} from '@/lib/actions';

const CATEGORIAS = ['Carnes', 'Bebidas', 'Acompanhamentos', 'Sobremesas', 'Gelo', 'Carvão', 'Outros'];

export default async function ContribuicoesPage({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const [participants, contributions] = await Promise.all([
    listParticipants(b.id),
    listContributions(b.id),
  ]);
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-bold mb-3">Nova contribuição</h2>
        <p className="text-xs text-coal-700 mb-3">Algo que um participante levou (carne, bebida, gelo) — o valor reconhecido aqui é descontado da parte dele e redistribuído entre os demais.</p>
        <form action={createContributionAction} className="grid sm:grid-cols-3 gap-3">
          <input type="hidden" name="barbecue_id" value={b.id} />
          <div>
            <label className="label">Participante *</label>
            <select className="input" name="participant_id" required>
              <option value="">Selecionar…</option>
              {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Descrição *</label><input className="input" name="description" required placeholder="Picanha 2kg" /></div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" name="category" defaultValue="Carnes">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Valor reconhecido (R$) *</label><input className="input" name="value" required inputMode="decimal" placeholder="0,00" /></div>
          <div><label className="label">Quantidade</label><input className="input" name="quantity" placeholder="opcional" /></div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue="aprovada">
              <option value="pendente">Pendente</option>
              <option value="aprovada">Aprovada</option>
              <option value="rejeitada">Rejeitada</option>
            </select>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button className="btn-primary" type="submit">Registrar contribuição</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Contribuições</h2>
        {contributions.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhuma contribuição registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Participante</th><th>Descrição</th><th>Categoria</th><th className="text-right">Valor</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td>{nameById.get(c.participant_id) || '—'}</td>
                    <td>{c.description}</td>
                    <td>{c.category || '—'}</td>
                    <td className="text-right money">{formatBRL(c.value_cents)}</td>
                    <td>
                      <form action={setContributionStatusAction} className="flex gap-1">
                        <input type="hidden" name="barbecue_id" value={b.id} />
                        <input type="hidden" name="contribution_id" value={c.id} />
                        {['pendente', 'aprovada', 'rejeitada'].map((s) => (
                          <button
                            key={s}
                            name="status"
                            value={s}
                            className={`pill ${c.status === s ? 'bg-ember-600 text-white' : 'bg-coal-100 text-coal-800'}`}
                            type="submit"
                          >
                            {s}
                          </button>
                        ))}
                      </form>
                    </td>
                    <td>
                      <form action={deleteContributionAction}>
                        <input type="hidden" name="barbecue_id" value={b.id} />
                        <input type="hidden" name="contribution_id" value={c.id} />
                        <button className="btn-ghost text-red-700" type="submit">Excluir</button>
                      </form>
                    </td>
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
