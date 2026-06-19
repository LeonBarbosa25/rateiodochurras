import { dbExec, sql } from '../src/lib/db';
import { hashPassword, newId, newToken } from '../src/lib/auth';

async function main() {
  const userId = newId();
  await dbExec(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING',
    userId,
    'Organizador Demo',
    'demo@churrasco.local',
    hashPassword('demo1234'),
  );

  const barbecueId = newId();
  await dbExec(
    `INSERT INTO barbecues (id, owner_id, name, theme, event_date, event_time, location, pix_key, pix_key_type, share_token, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto')`,
    barbecueId,
    userId,
    'Churrasco da Firma',
    'Festa Junina',
    '2026-07-18',
    '12:00',
    'Chácara do João',
    'demo@churrasco.local',
    'email',
    newToken(),
  );

  const nomes = ['João', 'Carlos', 'Pedro', 'Marcos', 'André', 'Lucas'];
  const participantIds: Record<string, string> = {};
  for (const nome of nomes) {
    const id = newId();
    participantIds[nome] = id;
    await dbExec(
      `INSERT INTO participants (id, barbecue_id, name, participates_in_split, access_token)
       VALUES (?, ?, ?, 1, ?)`,
      id,
      barbecueId,
      nome,
      newToken(),
    );
  }

  await dbExec(
    `INSERT INTO expenses (id, barbecue_id, description, category, quantity, unit_value_cents, total_value_cents, paid_by_name, included_in_split)
     VALUES (?, ?, 'Carnes variadas', 'Carnes', 1, 40000, 40000, 'Organizador', 1)`,
    newId(),
    barbecueId,
  );
  await dbExec(
    `INSERT INTO expenses (id, barbecue_id, description, category, quantity, unit_value_cents, total_value_cents, paid_by_name, included_in_split)
     VALUES (?, ?, 'Bebidas', 'Bebidas', 1, 15000, 15000, 'Organizador', 1)`,
    newId(),
    barbecueId,
  );
  await dbExec(
    `INSERT INTO expenses (id, barbecue_id, description, category, quantity, unit_value_cents, total_value_cents, paid_by_name, included_in_split)
     VALUES (?, ?, 'Carvão e gelo', 'Carvão', 1, 5000, 5000, 'Organizador', 1)`,
    newId(),
    barbecueId,
  );

  await dbExec(
    `INSERT INTO contributions (id, barbecue_id, participant_id, description, category, value_cents, status)
     VALUES (?, ?, ?, 'Picanha', 'Carnes', 10000, 'aprovada')`,
    newId(),
    barbecueId,
    participantIds.Pedro,
  );

  console.log('Seed criado.');
  console.log('Login: demo@churrasco.local / demo1234');
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
