import { notFound } from 'next/navigation';
import { getBarbecue, listExpenses } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { createExpenseAction, deleteExpenseAction } from '@/lib/actions';

const CATEGORIAS = ['Carnes', 'Bebidas', 'Acompanhamentos', 'Sobremesas', 'Gelo', 'Carvão', 'Descartáveis', 'Aluguel', 'Música', 'Decoração', 'Transporte', 'Outros'];

export default async function DespesasPage({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const expenses = await listExpenses(b.id);

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    const k = e.category || 'Outros';
    acc[k] = (acc[k] ?? 0) + e.total_value_cents;
    return acc;
  }, {});
  const total = expenses.reduce((a, e) => a + e.total_value_cents, 0);

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-bold mb-3">Nova despesa</h2>
        <form action={createExpenseAction} className="grid sm:grid-cols-3 gap-3">
          <input type="hidden" name="barbecue_id" value={b.id} />
          <div className="sm:col-span-2"><label className="label">Descrição *</label><input className="input" name="description" required /></div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" name="category" defaultValue="Carnes">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Quantidade</label><input className="input" name="quantity" defaultValue="1" /></div>
          <div><label className="label">Valor unitário (R$)</label><input className="input" name="unit_value" placeholder="0,00" inputMode="decimal" /></div>
          <div><label className="label">Valor total (R$)</label><input className="input" name="total_value" placeholder="0,00" inputMode="decimal" /></div>
          <div><label className="label">Data da compra</label><input className="input" name="purchase_date" type="date" /></div>
          <div><label className="label">Quem pagou</label><input className="input" name="paid_by_name" placeholder="Organizador" /></div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" name="included_in_split" defaultChecked /> Incluir no rateio
            </label>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button className="btn-primary" type="submit">Adicionar despesa</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Despesas</h2>
          <div className="text-sm">Total geral: <span className="money text-ember-700">{formatBRL(total)}</span></div>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-coal-700">Nenhuma despesa cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Descrição</th><th>Categoria</th><th>Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th><th>Quem pagou</th><th>Data</th><th>No rateio</th><th></th></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.description}</td>
                    <td>{e.category || '—'}</td>
                    <td>{e.quantity}</td>
                    <td className="text-right money">{formatBRL(e.unit_value_cents)}</td>
                    <td className="text-right money">{formatBRL(e.total_value_cents)}</td>
                    <td>{e.paid_by_name || '—'}</td>
                    <td>{e.purchase_date || '—'}</td>
                    <td>{e.included_in_split ? 'Sim' : 'Não'}</td>
                    <td>
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="barbecue_id" value={b.id} />
                        <input type="hidden" name="expense_id" value={e.id} />
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

      <div className="card">
        <h2 className="font-bold mb-3">Subtotal por categoria</h2>
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          {Object.entries(byCategory).sort(([, a], [, b]) => b - a).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-coal-100 py-1">
              <span>{k}</span>
              <span className="money">{formatBRL(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
