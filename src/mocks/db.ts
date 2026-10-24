/**
 * Estado único da API simulada.
 *
 * Catálogo, sessões, carrinhos, favoritos, carteiras e pedidos vivem no mesmo
 * objeto para manter consistência entre recursos (ex.: confirmar um pedido
 * baixa o estoque, emite `nft.updated` e remove itens do carrinho).
 * O estado é persistido em localStorage para sobreviver a refresh; `resetDb`
 * restaura integralmente o cenário conhecido (seed).
 */
import type { Network, NftUpdatedEvent, Order, Wallet } from "@/api/contracts";
import {
  buildNfts,
  FAVORITES,
  type NftRecord,
  USERS,
  type UserRecord,
  WALLETS,
} from "./fixtures";

const STORAGE_KEY = "kurio.mock.db";
const SCHEMA_VERSION = 4;

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface CartLineRecord {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
  priceAtAdd: string;
}

export interface CartRecord {
  id: string;
  ownerType: "guest" | "user";
  ownerId: string;
  items: CartLineRecord[];
  couponCode: string | null;
  version: number;
  updatedAt: string;
}

export interface OrderMeta {
  /** Epoch ms em que a liquidação simulada ocorre (null = manual) */
  settleAt: number | null;
  outcome: "approve" | "decline";
}

export interface IdempotencyRecord {
  fingerprint: string;
  orderId: string;
}

export interface WalletConnectionRecord {
  id: string;
  walletId: string;
  userId: string;
  network: Network;
  connectedAt: string;
}

export interface DbState {
  schema: number;
  nfts: NftRecord[];
  users: UserRecord[];
  sessions: SessionRecord[];
  carts: Record<string, CartRecord>;
  favorites: Record<string, string[]>;
  wallets: Record<string, Wallet[]>;
  walletConnections: Record<string, WalletConnectionRecord>;
  orders: Order[];
  orderMeta: Record<string, OrderMeta>;
  idempotency: Record<string, IdempotencyRecord>;
  /** Últimos eventos emitidos (para cenários de duplicata/replay) */
  recentNftEvents: NftUpdatedEvent[];
  seq: number;
}

function seed(): DbState {
  return {
    schema: SCHEMA_VERSION,
    nfts: buildNfts(),
    users: structuredClone(USERS),
    sessions: [],
    carts: {},
    favorites: structuredClone(FAVORITES),
    wallets: structuredClone(WALLETS),
    walletConnections: {},
    orders: [],
    orderMeta: {},
    idempotency: {},
    recentNftEvents: [],
    seq: 1000,
  };
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.schema === SCHEMA_VERSION) return parsed;
    }
  } catch {
    // Storage indisponível ou corrompido: volta ao seed.
  }
  return seed();
}

export const db: { state: DbState } = { state: load() };

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db.state));
  } catch {
    // Quota excedida ou storage bloqueado: mantém só em memória.
  }
}

export function resetDb() {
  db.state = seed();
  persist();
}

export function nextId(prefix: string) {
  db.state.seq += 1;
  return `${prefix}_${db.state.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function findNft(id: string) {
  return db.state.nfts.find((n) => n.id === id);
}

export function findUser(id: string) {
  return db.state.users.find((u) => u.id === id);
}
