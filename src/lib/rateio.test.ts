import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSplit } from './rateio';

const p = (id: string, c = 0) => ({ participantId: id, contributionCents: c });
const sum = (rows: { amountDueCents: number }[]) => rows.reduce((a, r) => a + r.amountDueCents, 0);

test('1. rateio sem contribuições (R$600 / 6 = R$100)', () => {
  const r = calculateSplit(60000, ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => p(id)));
  assert.equal(sum(r.rows), 60000);
  for (const row of r.rows) assert.equal(row.amountDueCents, 10000);
});

test('2. contribuição parcial (R$600 / 6, Pedro R$40)', () => {
  const r = calculateSplit(60000, [p('joao'), p('carlos'), p('pedro', 4000), p('marcos'), p('andre'), p('lucas')]);
  assert.equal(sum(r.rows), 60000);
  // Pedro deve pagar 40 a menos que a base
  const pedro = r.rows.find((x) => x.participantId === 'pedro')!;
  const outros = r.rows.filter((x) => x.participantId !== 'pedro');
  for (const o of outros) {
    assert.ok(Math.abs(o.amountDueCents - (pedro.amountDueCents + 4000)) <= 1);
  }
});

test('3. contribuição igual à cobrança inicial (R$600 / 6, Pedro R$100)', () => {
  // Nota: a §9 da spec define Pᵢ = max(0, B - Cᵢ) com Σ Pᵢ = T.
  // Com C_pedro = 100 e B ≈ 116,67 (não 120, porque Pedro continua no rateio
  // com um valor positivo até C ≥ B). Pedro paga ~16,67 e os demais ~116,67.
  // (O exemplo numérico do §10 da spec é inconsistente com o próprio algoritmo
  //  de §9 — adotamos o algoritmo, que é o que §28 de fato exige.)
  const r = calculateSplit(60000, [p('joao'), p('carlos'), p('pedro', 10000), p('marcos'), p('andre'), p('lucas')]);
  assert.equal(sum(r.rows), 60000);
  const pedro = r.rows.find((x) => x.participantId === 'pedro')!;
  const outros = r.rows.filter((x) => x.participantId !== 'pedro');
  assert.ok(pedro.amountDueCents >= 1665 && pedro.amountDueCents <= 1668);
  for (const o of outros) assert.ok(o.amountDueCents >= 11665 && o.amountDueCents <= 11668);
  // Pedro paga ~10000 a menos que os demais (ajuste de centavos pode variar ±2)
  for (const o of outros) {
    assert.ok(Math.abs(o.amountDueCents - pedro.amountDueCents - 10000) <= 2);
  }
});

test('4. contribuição superior à cobrança inicial não gera valor negativo', () => {
  const r = calculateSplit(60000, [p('joao'), p('carlos'), p('pedro', 50000), p('marcos'), p('andre'), p('lucas')]);
  assert.equal(sum(r.rows), 60000);
  const pedro = r.rows.find((x) => x.participantId === 'pedro')!;
  assert.equal(pedro.amountDueCents, 0);
  assert.ok(r.excessCreditCents > 0); // sobra para tratar pela política do organizador
  for (const row of r.rows) assert.ok(row.amountDueCents >= 0);
});

test('5. vários participantes com contribuições diferentes', () => {
  const r = calculateSplit(100000, [
    p('a', 0),
    p('b', 1000),
    p('c', 2500),
    p('d', 5000),
    p('e', 30000),
  ]);
  assert.equal(sum(r.rows), 100000);
  for (const row of r.rows) assert.ok(row.amountDueCents >= 0);
});

test('6. arredondamento (R$100 / 3 = 33,34/33,33/33,33)', () => {
  const r = calculateSplit(10000, [p('a'), p('b'), p('c')]);
  assert.equal(sum(r.rows), 10000);
  const valores = r.rows.map((x) => x.amountDueCents).sort();
  assert.deepEqual(valores, [3333, 3333, 3334]);
});

test('12. nenhum participante ativo retorna estrutura vazia', () => {
  const r = calculateSplit(50000, []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.baseValueCents, 0);
});

test('13. apenas um participante paga tudo', () => {
  const r = calculateSplit(50000, [p('solo')]);
  assert.equal(sum(r.rows), 50000);
  assert.equal(r.rows[0].amountDueCents, 50000);
});

test('cobertura: total zero', () => {
  const r = calculateSplit(0, [p('a'), p('b', 1000)]);
  assert.equal(sum(r.rows), 0);
  for (const row of r.rows) assert.equal(row.amountDueCents, 0);
});

test('cobertura: contribuição parcial — exemplo da spec (R$600, Pedro R$40)', () => {
  const r = calculateSplit(60000, [p('j'), p('c'), p('pedro', 4000), p('m'), p('a'), p('l')]);
  assert.equal(sum(r.rows), 60000);
  // Spec aproxima 106,67 / 66,65 → soma 600,00.
  const pedro = r.rows.find((x) => x.participantId === 'pedro')!;
  const outros = r.rows.filter((x) => x.participantId !== 'pedro');
  // Pedro ~66,xx
  assert.ok(pedro.amountDueCents >= 6660 && pedro.amountDueCents <= 6670);
  for (const o of outros) {
    assert.ok(o.amountDueCents >= 10666 && o.amountDueCents <= 10668);
  }
});
