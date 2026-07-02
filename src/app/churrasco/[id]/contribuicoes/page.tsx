import { notFound } from 'next/navigation';
import { getBarbecue, listContributions, listParticipants } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import {
  createContributionAction,
  deleteContributionAction,
  updateContributionAction,
} from '@/lib/actions';
import SubmitButton from '@/app/SubmitButton';
import ConfirmDelete from '@/app/ConfirmDelete';

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
        <p className="text-xs text-coal-700 mb-3">Escolha o participante que levou algo, ou <strong>Sobrou</strong> para registrar itens que sobraram (o organizador ficou com eles). O valor da sobra é cobrado do organizador e dividido como desconto entre os demais participantes.</p>
        <form action={createContributionAction} className="grid sm:grid-cols-3 gap-3">
          <input type="hidden" name="barbecue_id" value={b.id} />
          <div>
            <label className="label">Quem levou</label>
            <select className="input" name="participant_id" defaultValue="">
                                  <option value="">Sobrou (organizador ficou com o item)</option>
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
            <SubmitButton label="Registrar contribuição" />
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
                    <td colSpan={6}>
                      <div className="space-y-3">
                        <div className="grid md:grid-cols-6 gap-2 items-center">
                          <span className="font-medium">{c.participant_id ? nameById.get(c.participant_id) || '—' : '🍗 Sobrou'}</span>
                          <span className="md:col-span-2">{c.description}</span>
                          <span>{c.category || '—'}</span>
                          <span className="money text-right text-ember-700">{formatBRL(c.value_cents)}</span>
                          <span>{c.status}</span>
                        </div>
                        <div className="flex justify-between text-xs text-coal-700">
                          <details className="flex-1 text-right">
                            <summary className="btn-ghost cursor-pointer inline-flex">Editar</summary>
                            <form action={updateContributionAction} className="grid md:grid-cols-7 gap-2 items-end mt-3 border-t border-coal-100 pt-3 text-left">
                              <input type="hidden" name="barbecue_id" value={b.id} />
                              <input type="hidden" name="contribution_id" value={c.id} />
                              <div>
                                <label className="label">Quem levou</label>
                                <select className="input" name="participant_id" defaultValue={c.participant_id ?? ''}>
              <option value="">Sobrou (organizador ficou com o item)</option>
                                  {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Descrição</label>
                                <input className="input" name="description" defaultValue={c.description} required />
                              </div>
                              <div>
                                <label className="label">Categoria</label>
                                <select className="input" name="category" defaultValue={c.category ?? 'Carnes'}>
                                  {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label">Valor</label>
                                <input className="input" name="value" defaultValue={(c.value_cents / 100).toFixed(2).replace('.', ',')} inputMode="decimal" required />
                              </div>
                              <div>
                                <label className="label">Qtd</label>
                                <input className="input" name="quantity" defaultValue={c.quantity ? String(c.quantity).replace('.', ',') : ''} />
                              </div>
                              <div>
                                <label className="label">Status</label>
                                <select className="input" name="status" defaultValue={c.status}>
                                  <option value="pendente">Pendente</option>
                                  <option value="aprovada">Aprovada</option>
                                  <option value="rejeitada">Rejeitada</option>
                                </select>
                              </div>
                              <div className="md:col-span-7 flex justify-end">
                                <SubmitButton label="Salvar" />
                              </div>
                            </form>
                          </details>
                          <ConfirmDelete formAction={deleteContributionAction} message="Excluir esta contribuição?">
                            <input type="hidden" name="barbecue_id" value={b.id} />
                            <input type="hidden" name="contribution_id" value={c.id} />
                          </ConfirmDelete>
                        </div>
                      </div>
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
