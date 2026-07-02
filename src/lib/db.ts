// Cliente Postgres (Vercel Postgres / Neon / Supabase / local).
// Auto-migra o schema no primeiro uso; helpers `dbAll/dbGet/dbExec`
// aceitam SQL com placeholders "?" (estilo SQLite) para reduzir a
// distância em relação ao código existente — eles são convertidos
// para $1, $2... antes de bater no Postgres.

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Não derruba em build-time (Next pode chamar este módulo durante
  // collect page data); apenas falha em runtime se for usado.
  console.warn('[db] DATABASE_URL ausente — defina em .env.local ou no Vercel.');
}

const sql = postgres(connectionString || 'postgres://invalid', {
  ssl: process.env.PGSSL === '1' || /sslmode=require/i.test(connectionString || '') ? 'require' : undefined,
  prepare: false,
  max: 5,
  idle_timeout: 20,
  onnotice: () => {},
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS barbecues (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  theme TEXT,
  event_date TEXT,
  event_time TEXT,
  location TEXT,
  description TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  barbecue_id TEXT NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  participates_in_split INTEGER NOT NULL DEFAULT 1,
  attendance_status TEXT NOT NULL DEFAULT 'pendente',
  is_organizer INTEGER NOT NULL DEFAULT 0,
  access_token TEXT NOT NULL UNIQUE,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  barbecue_id TEXT NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  quantity REAL DEFAULT 1,
  unit_value_cents INTEGER NOT NULL DEFAULT 0,
  total_value_cents INTEGER NOT NULL DEFAULT 0,
  purchase_date TEXT,
  paid_by_name TEXT,
  included_in_split INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  barbecue_id TEXT NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  value_cents INTEGER NOT NULL DEFAULT 0,
  quantity REAL,
  status TEXT NOT NULL DEFAULT 'aprovada',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  barbecue_id TEXT NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  value_cents INTEGER NOT NULL,
  payment_date TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'informado',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  barbecue_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_data TEXT,
  new_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_barbecue ON participants(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_expenses_barbecue ON expenses(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_contributions_barbecue ON contributions(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_payments_barbecue ON payments(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
DO $$ BEGIN ALTER TABLE contributions ALTER COLUMN participant_id DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE barbecues ADD COLUMN IF NOT EXISTS pix_receiver_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
`;

let schemaPromise: Promise<void> | null = null;
async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const exists = await sql.unsafe(`
        SELECT to_regclass('public.users') AS users,
               EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'receipt_url'
               ) AS has_receipt_url,
               EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'barbecues' AND column_name = 'pix_receiver_name'
               ) AS has_pix_receiver_name,
               (SELECT is_nullable = 'YES' FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'contributions' AND column_name = 'participant_id') AS participant_nullable
      `) as unknown as { users: string | null; has_receipt_url: boolean; has_pix_receiver_name: boolean; participant_nullable: boolean }[];
      if (exists[0]?.users && exists[0]?.has_receipt_url && exists[0]?.has_pix_receiver_name && exists[0]?.participant_nullable) return;

      // executa cada statement separadamente para sermos compatíveis com
      // drivers que não aceitam múltiplos statements via unsafe
      const stmts = SCHEMA.split(/;\s*(?=CREATE|ALTER|INSERT|DROP)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of stmts) {
        await sql.unsafe(stmt);
      }
    })();
  }
  await schemaPromise;
}

// Converte placeholders "?" para "$1, $2..." (estilo Postgres)
function qmarkToDollar(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

export async function dbAll<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  await ensureSchema();
  const rows = await sql.unsafe(qmarkToDollar(query), params as never);
  return rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T | undefined> {
  const rows = await dbAll<T>(query, ...params);
  return rows[0];
}

export async function dbExec(query: string, ...params: unknown[]): Promise<void> {
  await dbAll(query, ...params);
}

export { sql };
