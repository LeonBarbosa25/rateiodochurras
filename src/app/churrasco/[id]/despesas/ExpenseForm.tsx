'use client';

import { useState } from 'react';
import SubmitButton from '@/app/SubmitButton';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  barbecueId: string;
  categories: string[];
  expense?: {
    id: string;
    description: string;
    category: string | null;
    quantity: number;
    unit_value_cents: number;
    total_value_cents: number;
    purchase_date: string | null;
    paid_by_name: string | null;
    included_in_split: number;
  };
  compact?: boolean;
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function parseMoney(value: string) {
  const clean = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  return Math.round((Number(clean) || 0) * 100);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({ action, barbecueId, categories, expense, compact }: Props) {
  const [useWeight, setUseWeight] = useState(false);
  const [quantity, setQuantity] = useState(String(expense?.quantity ?? 1).replace('.', ','));
  const [unitValue, setUnitValue] = useState(expense ? centsToInput(expense.unit_value_cents) : '');
  const [totalValue, setTotalValue] = useState(expense ? centsToInput(expense.total_value_cents) : '');
  const [purchaseDate, setPurchaseDate] = useState(expense?.purchase_date ?? '');

  function recalc(nextQuantity = quantity, nextUnit = unitValue) {
    const qty = Number(nextQuantity.replace(',', '.')) || 0;
    const cents = parseMoney(nextUnit);
    setTotalValue(centsToInput(Math.round(qty * cents)));
  }

  return (
    <form action={action} className={`grid gap-3 ${compact ? 'sm:grid-cols-6' : 'sm:grid-cols-3'}`}>
      <input type="hidden" name="barbecue_id" value={barbecueId} />
      {expense && <input type="hidden" name="expense_id" value={expense.id} />}
      <div className={compact ? 'sm:col-span-2' : 'sm:col-span-2'}>
        <label className="label">Descrição *</label>
        <input className="input" name="description" required defaultValue={expense?.description ?? ''} />
      </div>
      <div>
        <label className="label">Categoria</label>
        <select className="input" name="category" defaultValue={expense?.category ?? 'Carnes'}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Quantidade</label>
        <input
          className="input"
          name="quantity"
          placeholder={useWeight ? 'Ex.: 1,5 ou ,700' : 'Ex.: 4'}
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            recalc(event.target.value, unitValue);
          }}
        />
      </div>
      <div>
        <label className="label">{useWeight ? 'Preço por kg (R$)' : 'Valor unitário (R$)'}</label>
        <input
          className="input"
          name="unit_value"
          placeholder="0,00"
          inputMode="decimal"
          value={unitValue}
          onChange={(event) => {
            setUnitValue(event.target.value);
            recalc(quantity, event.target.value);
          }}
        />
      </div>
      <div>
        <label className="label">Valor total (R$)</label>
        <div className="flex gap-2">
          <input className="input" name="total_value" placeholder="0,00" inputMode="decimal" value={totalValue} onChange={(event) => setTotalValue(event.target.value)} />
          <button
            className={useWeight ? 'btn-primary whitespace-nowrap' : 'btn-secondary whitespace-nowrap'}
            type="button"
            onClick={() => {
              setUseWeight((current) => !current);
              recalc(quantity, unitValue);
            }}
          >
            Preço/kg
          </button>
        </div>
        {useWeight && <p className="text-xs text-coal-700 mt-1">Digite o peso em kg. Ex.: <strong>,700</strong> = 700g.</p>}
      </div>
      <div>
        <label className="label">Data da compra</label>
        <div className="flex gap-2">
          <input className="input" name="purchase_date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          <button className="btn-secondary whitespace-nowrap" type="button" onClick={() => setPurchaseDate(today())}>Hoje</button>
        </div>
      </div>
      <div>
        <label className="label">Quem pagou</label>
        <input className="input" name="paid_by_name" placeholder="Organizador" defaultValue={expense?.paid_by_name ?? ''} />
      </div>
      <div className="flex items-end">
        <label className="inline-flex items-center gap-2 text-sm pb-2">
          <input type="checkbox" name="included_in_split" defaultChecked={expense ? Boolean(expense.included_in_split) : true} /> Incluir no rateio
        </label>
      </div>
      <div className={compact ? 'sm:col-span-6 flex justify-end' : 'sm:col-span-3 flex justify-end'}>
        <SubmitButton label={expense ? 'Salvar despesa' : 'Adicionar despesa'} />
      </div>
    </form>
  );
}
