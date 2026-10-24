/**
 * Persistência do contexto do checkout em sessionStorage:
 * - rede escolhida (compartilhada com o carrinho);
 * - rascunho dos dados do colecionador (retomada após expiração de sessão);
 * - tentativa de pedido em andamento (chave de idempotência + corpo), usada
 *   para recuperar o MESMO pedido após timeout, refresh ou reconexão.
 */
import type {
  CollectorInfo,
  CreateOrderRequest,
  Network,
} from "@/api/contracts";
import { NETWORKS } from "@/api/contracts";

const NETWORK_KEY = "kurio.checkout.network";
const DRAFT_KEY = "kurio.checkout.draft";
const ATTEMPT_KEY = "kurio.checkout.attempt";

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignora
  }
}

export function getCheckoutNetwork(): Network {
  const value = read<Network>(NETWORK_KEY);
  return value && NETWORKS.includes(value) ? value : "ethereum";
}
export const setCheckoutNetwork = (network: Network) =>
  write(NETWORK_KEY, network);

export interface CheckoutDraft {
  userId: string;
  collector: CollectorInfo;
  walletId?: string;
}
export const getCheckoutDraft = (userId: string) => {
  const draft = read<CheckoutDraft>(DRAFT_KEY);
  return draft?.userId === userId ? draft : null;
};
export const setCheckoutDraft = (draft: CheckoutDraft | null) =>
  write(DRAFT_KEY, draft);

export interface OrderAttempt {
  userId: string;
  key: string;
  body: CreateOrderRequest;
  startedAt: number;
}
export const getOrderAttempt = (userId: string) => {
  const attempt = read<OrderAttempt>(ATTEMPT_KEY);
  return attempt?.userId === userId ? attempt : null;
};
export const setOrderAttempt = (attempt: OrderAttempt | null) =>
  write(ATTEMPT_KEY, attempt);
