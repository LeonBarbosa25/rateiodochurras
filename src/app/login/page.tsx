import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { loginAction, registerAction } from '@/lib/actions';

export default async function LoginPage({ searchParams }: { searchParams: { tab?: string } }) {
  if (await getSessionUser()) redirect('/');
  const tab = searchParams.tab === 'registrar' ? 'registrar' : 'entrar';

  return (
    <div className="max-w-md mx-auto card mt-8">
      <div className="text-center mb-4">
        <div className="text-3xl">🔥</div>
        <h1 className="text-xl font-bold mt-1">Rateio do Churras</h1>
        <p className="text-sm text-coal-700">Organize, divida e cobre — sem dor de cabeça.</p>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        <Link href="?tab=entrar" className={`flex-1 text-center py-2 rounded-xl ${tab === 'entrar' ? 'bg-ember-600 text-white' : 'bg-coal-100'}`}>Entrar</Link>
        <Link href="?tab=registrar" className={`flex-1 text-center py-2 rounded-xl ${tab === 'registrar' ? 'bg-ember-600 text-white' : 'bg-coal-100'}`}>Criar conta</Link>
      </div>

      {tab === 'entrar' ? (
        <form action={loginAction} className="space-y-3">
          <div><label className="label">E-mail</label><input className="input" name="email" type="email" required /></div>
          <div><label className="label">Senha</label><input className="input" name="password" type="password" required /></div>
          <button className="btn-primary w-full" type="submit">Entrar</button>
        </form>
      ) : (
        <form action={registerAction} className="space-y-3">
          <div><label className="label">Nome</label><input className="input" name="name" required /></div>
          <div><label className="label">E-mail</label><input className="input" name="email" type="email" required /></div>
          <div><label className="label">Senha (mín. 6)</label><input className="input" name="password" type="password" minLength={6} required /></div>
          <button className="btn-primary w-full" type="submit">Criar conta</button>
        </form>
      )}
    </div>
  );
}
