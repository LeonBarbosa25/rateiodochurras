import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createBarbecueAction } from '@/lib/actions';

export default async function NewBarbecuePage() {
  if (!(await getSessionUser())) redirect('/login');
  return (
    <div className="max-w-2xl mx-auto card">
      <h1 className="text-xl font-bold mb-1">Novo churrasco</h1>
      <p className="text-sm text-coal-700 mb-5">Preencha os dados básicos. Depois você adiciona participantes, despesas e contribuições.</p>
      <form action={createBarbecueAction} className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className="label">Nome do churrasco *</label><input className="input" name="name" required placeholder="Churrasco da Firma" /></div>
        <div><label className="label">Tema</label><input className="input" name="theme" placeholder="Festa Junina" /></div>
        <div><label className="label">Local</label><input className="input" name="location" placeholder="Chácara do João" /></div>
        <div><label className="label">Data</label><input className="input" name="event_date" type="date" /></div>
        <div><label className="label">Horário</label><input className="input" name="event_time" type="time" /></div>
        <div><label className="label">Chave Pix</label><input className="input" name="pix_key" placeholder="email@exemplo.com" /></div>
        <div>
          <label className="label">Tipo da chave Pix</label>
          <select className="input" name="pix_key_type" defaultValue="">
            <option value="">—</option>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="email">E-mail</option>
            <option value="telefone">Telefone</option>
            <option value="aleatoria">Aleatória</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Descrição</label><textarea className="input" name="description" rows={2} /></div>
        <div className="sm:col-span-2"><label className="label">Observações para os participantes</label><textarea className="input" name="notes" rows={2} /></div>
        <div className="sm:col-span-2 flex gap-2 justify-end mt-2">
          <button className="btn-primary" type="submit">Criar churrasco</button>
        </div>
      </form>
    </div>
  );
}
