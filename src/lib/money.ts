// Valores monetários sempre em centavos inteiros.
// Nunca usar float para somar/dividir dinheiro.

export function formatBRL(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const cent = abs % 100;
  const reaisStr = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${reaisStr},${cent.toString().padStart(2, '0')}`;
}

// Aceita "10,50", "10.50", "R$ 1.234,56", "1234,56". Retorna centavos inteiros.
export function parseBRL(input: string): number {
  if (input == null) return 0;
  const cleaned = input
    .toString()
    .replace(/\s/g, '')
    .replace(/R\$/i, '')
    .trim();
  if (!cleaned) return 0;

  let normalized: string;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    // formato BR: pontos como milhar, vírgula como decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else {
    normalized = cleaned;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsFromReaisInt(reais: number, centavos: number): number {
  return Math.trunc(reais) * 100 + Math.trunc(centavos);
}
