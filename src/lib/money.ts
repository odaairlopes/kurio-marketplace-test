import Big from "big.js";
import type { Decimal } from "@/api/contracts";

// Precisão de 18 casas (wei) e arredondamento "half-even" para cálculos.
Big.DP = 18;
Big.RM = Big.roundHalfEven;

export const ZERO: Decimal = "0";

export function dec(value: Decimal | number): Big {
  return new Big(value);
}

export function add(...values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString();
}

export function sub(a: Decimal, b: Decimal): Decimal {
  return new Big(a).minus(b).toString();
}

export function mul(a: Decimal, qty: number | Decimal): Decimal {
  return new Big(a).times(qty).toString();
}

/** Percentual inteiro sobre um valor, arredondado a 6 casas (precisão de exibição de ETH). */
export function percentOf(value: Decimal, percent: number): Decimal {
  return new Big(value)
    .times(percent)
    .div(100)
    .round(6, Big.roundHalfEven)
    .toString();
}

export function cmp(a: Decimal, b: Decimal): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1;
}

export function isDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

/** Normaliza entrada do usuário ("1,5" → "1.5"). Retorna null se inválida. */
export function parseDecimalInput(value: string): Decimal | null {
  const normalized = value.trim().replace(",", ".");
  if (!isDecimal(normalized)) return null;
  return new Big(normalized).toString();
}

/**
 * Formata ETH para exibição sem passar por number/float.
 * Mantém no mínimo 2 e no máximo `maxDecimals` casas.
 */
export function formatEth(
  value: Decimal,
  {
    maxDecimals = 4,
    symbol = true,
  }: { maxDecimals?: number; symbol?: boolean } = {},
): string {
  const fixed = new Big(value)
    .round(maxDecimals, Big.roundHalfEven)
    .toFixed(maxDecimals);
  const [int, frac = ""] = fixed.split(".");
  let trimmed = frac.replace(/0+$/, "");
  if (trimmed.length < 2) trimmed = trimmed.padEnd(2, "0");
  const out = `${int}.${trimmed}`;
  return symbol ? `${out} ETH` : out;
}
