/**
 * Algoritmo de rateio com piso zero.
 * Encontra um valor-base B (em centavos) tal que
 *   Σ max(0, B - Cᵢ) = T
 * Depois ajusta centavos restantes nos participantes com maior valor devido.
 *
 * Garantias:
 *  - Σ Pᵢ == T (exatamente, em centavos)
 *  - Pᵢ >= 0 para todo i
 *  - quem contribuiu recebe desconto; sobra é redistribuída
 */

export type SplitInput = {
  participantId: string;
  contributionCents: number; // >= 0
};

export type SplitOutputRow = {
  participantId: string;
  contributionCents: number;
  rawAmountCents: number;  // antes do ajuste de centavos
  amountDueCents: number;  // final
};

export type SplitResult = {
  totalCents: number;
  baseValueCents: number; // B encontrado (arredondado para centavo mais próximo)
  rows: SplitOutputRow[];
  excessCreditCents: number; // soma de (C - B) para quem contribuiu mais do que pagaria
};

export function calculateSplit(totalCents: number, participants: SplitInput[]): SplitResult {
  if (totalCents < 0) throw new Error('Total não pode ser negativo');
  if (participants.length === 0) {
    return { totalCents, baseValueCents: 0, rows: [], excessCreditCents: 0 };
  }

  // Caso trivial: total zero
  if (totalCents === 0) {
    return {
      totalCents: 0,
      baseValueCents: 0,
      rows: participants.map((p) => ({
        participantId: p.participantId,
        contributionCents: p.contributionCents,
        rawAmountCents: 0,
        amountDueCents: 0,
      })),
      excessCreditCents: participants.reduce((acc, p) => acc + p.contributionCents, 0),
    };
  }

  const maxContrib = participants.reduce((m, p) => Math.max(m, p.contributionCents), 0);

  // Busca binária sobre B (em centavos, valor inteiro).
  // Limites: 0 .. T + maior contribuição.
  let lo = 0;
  let hi = totalCents + maxContrib;

  const sumAt = (B: number) =>
    participants.reduce((acc, p) => acc + Math.max(0, B - p.contributionCents), 0);

  // Convergir até lo == hi
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sumAt(mid) < totalCents) lo = mid + 1;
    else hi = mid;
  }
  const base = lo;

  // Valores crus
  const raw = participants.map((p) => ({
    participantId: p.participantId,
    contributionCents: p.contributionCents,
    rawAmountCents: Math.max(0, base - p.contributionCents),
  }));

  const rawSum = raw.reduce((acc, r) => acc + r.rawAmountCents, 0);
  // diff pode ser negativo (precisamos remover centavos) ou positivo (precisamos adicionar)
  let diff = totalCents - rawSum;

  // Ordena para distribuir: prioriza quem tem maior valor devido (e desempata por id estável)
  // Para remover centavos: subtraímos dos maiores. Para adicionar: somamos aos maiores.
  const indexed = raw.map((r, i) => ({ ...r, i }));
  indexed.sort((a, b) => {
    if (b.rawAmountCents !== a.rawAmountCents) return b.rawAmountCents - a.rawAmountCents;
    return a.i - b.i;
  });

  const adjust: number[] = new Array(raw.length).fill(0);

  if (diff > 0) {
    let k = 0;
    while (diff > 0) {
      adjust[indexed[k % indexed.length].i] += 1;
      diff -= 1;
      k += 1;
    }
  } else if (diff < 0) {
    // Remove de centavo em centavo dos maiores; não deixa valor ficar negativo
    let k = 0;
    let safety = 0;
    const max = indexed.length * (totalCents + 1) + 1;
    while (diff < 0 && safety < max) {
      const idx = indexed[k % indexed.length].i;
      const current = raw[idx].rawAmountCents + adjust[idx];
      if (current > 0) {
        adjust[idx] -= 1;
        diff += 1;
      }
      k += 1;
      safety += 1;
    }
  }

  const rows: SplitOutputRow[] = raw.map((r, idx) => ({
    participantId: r.participantId,
    contributionCents: r.contributionCents,
    rawAmountCents: r.rawAmountCents,
    amountDueCents: r.rawAmountCents + adjust[idx],
  }));

  const excessCreditCents = participants.reduce(
    (acc, p) => acc + Math.max(0, p.contributionCents - base),
    0,
  );

  return { totalCents, baseValueCents: base, rows, excessCreditCents };
}
