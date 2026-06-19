import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dbExec, dbGet } from './db';

const SESSION_COOKIE = 'session_id';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newId(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

export function newToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export type SessionUser = { id: string; name: string; email: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return null;
  const row = await dbGet<SessionUser>(
    `SELECT u.id, u.name, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    c.value,
  );
  return row ?? null;
}

export async function createSession(userId: string) {
  const id = newId(24);
  await dbExec('INSERT INTO sessions (id, user_id) VALUES (?, ?)', id, userId);
  cookies().set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const c = cookies().get(SESSION_COOKIE);
  if (c?.value) await dbExec('DELETE FROM sessions WHERE id = ?', c.value);
  cookies().delete(SESSION_COOKIE);
}
