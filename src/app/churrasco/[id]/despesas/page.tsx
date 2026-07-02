import { notFound } from 'next/navigation';
import { getBarbecue, listExpenses } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { formatDateBR } from '@/lib/date';
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from '@/lib/actions';
import ExpenseForm from './ExpenseForm';
import ConfirmDelete from '@/app/ConfirmDelete';

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
        <ExpenseForm action={createExpenseAction} barbecueId={b.id} categories={CATEGORIAS} />
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
                    <td colSpan={9}>
                      <div className="space-y-3">
                        <div className="grid md:grid-cols-9 gap-2 items-center">
                          <span className="md:col-span-2 font-medium">{e.description}</span>
                          <span>{e.category || '—'}</span>
                          <span>Qtd {e.quantity}</span>
                          <span className="money text-right">{formatBRL(e.unit_value_cents)}</span>
                          <span className="money text-right text-ember-700">{formatBRL(e.total_value_cents)}</span>
                          <span>{e.paid_by_name || '—'}</span>
                          <span>{formatDateBR(e.purchase_date)}</span>
                          <span>{e.included_in_split ? 'Rateio' : 'Fora'}</span>
                        </div>
                        <div className="flex justify-end gap-2 text-xs text-coal-700">
                          <details className="flex-1 text-right">
                            <summary className="btn-ghost cursor-pointer inline-flex">Editar</summary>
                            <div className="mt-3 border-t border-coal-100 pt-3 text-left">
                              <ExpenseForm action={updateExpenseAction} barbecueId={b.id} categories={CATEGORIAS} expense={e} compact />
                            </div>
                          </details>
                          <ConfirmDelete formAction={deleteExpenseAction} message="Excluir esta despesa?">
                            <input type="hidden" name="barbecue_id" value={b.id} />
                            <input type="hidden" name="expense_id" value={e.id} />
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
