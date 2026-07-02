import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';

export const metadata: Metadata = {
  title: 'Rateio de Churrasco',
  description: 'Organize, registre despesas e divida a conta do churrasco.',
};

export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="pt-BR">
      <body className="text-coal-900">
        <header className="border-b border-coal-100 bg-white/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span aria-hidden>🔥</span>
              <span>Rateio do Churras</span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              {user ? (
                <>
                  <Link href="/participantes" className="btn-secondary hidden sm:inline-flex">Participantes</Link>
                  <span className="text-coal-700 hidden sm:inline">{user.name}</span>
                  <form action={logoutAction}>
                    <button className="btn-ghost" type="submit">Sair</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn-secondary">Entrar</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-coal-700 opacity-60">
          Valores monetários em centavos · Algoritmo iterativo com piso zero · MVP
        </footer>
      </body>
    </html>
  );
}
