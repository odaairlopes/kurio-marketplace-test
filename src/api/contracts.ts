/**
 * Contratos REST e de eventos da KURIO.
 *
 * Este arquivo é a fonte única de tipos entre transporte (Axios / handlers MSW),
 * estado (TanStack Query) e interface. Valores em ETH trafegam SEMPRE como
 * strings decimais ("1.19"); quantidades são inteiros.
 */

export type Decimal = string;
export type ISODate = string;

export const NETWORKS = ["ethereum", "polygon", "solana"] as const;
export type Network = (typeof NETWORKS)[number];

export const COLLECTIONS = [
  "arte-digital",
  "fotografia",
  "musica",
  "arte-3d",
  "colecionaveis",
  "generativa",
  "jogos",
  "assinaturas",
  "utilidade",
] as const;
export type CollectionId = (typeof COLLECTIONS)[number];

export const CATALOG_TABS = ["all", "new", "trending"] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

export const SORT_OPTIONS = [
  "recent",
  "price-asc",
  "price-desc",
  "popular",
  "rating",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "HANDLE_TAKEN"
  | "AVAILABILITY_CONFLICT"
  | "EDITION_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "COUPON_INVALID"
  | "COUPON_EXPIRED"
  | "QUOTE_CHANGED"
  | "IDEMPOTENCY_CONFLICT"
  | "WALLET_CONFLICT"
  | "WALLET_REJECTED"
  | "WALLET_NOT_CONNECTED"
  | "NETWORK_UNSUPPORTED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Erros por campo: { email: 'E-mail já cadastrado' } */
    fields?: Record<string, string>;
    /** Dados extras (ex.: nova cotação em QUOTE_CHANGED) */
    details?: unknown;
    retryable?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface Edition {
  id: string;
  label: string;
  price: Decimal;
  /** Unidades disponíveis para venda */
  available: number;
  /** Limite por pedido */
  maxPerOrder: number;
  supply: number;
}

export interface NftSummary {
  id: string;
  name: string;
  tokenId: string;
  collection: CollectionId;
  network: Network;
  creator: string;
  image: string;
  imageSmall: string;
  /** Menor preço entre as edições disponíveis (ou da primeira edição) */
  price: Decimal;
  previousPrice: Decimal | null;
  rating: { average: number; count: number };
  listedAt: ISODate;
  isNew: boolean;
  trending: boolean;
  soldOut: boolean;
  version: number;
}

export interface NftDetail extends NftSummary {
  description: string;
  images: string[];
  editions: Edition[];
  royaltiesPercent: number;
  contractAddress: string;
}

export interface CatalogQuery {
  q?: string;
  collections?: CollectionId[];
  networks?: Network[];
  minPrice?: Decimal;
  maxPrice?: Decimal;
  tab?: CatalogTab;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface Facet<T extends string> {
  id: T;
  count: number;
}

export interface CatalogResponse {
  items: NftSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: {
    collections: Facet<CollectionId>[];
    networks: Facet<Network>[];
    priceRange: { min: Decimal; max: Decimal };
  };
}

export interface FeaturedResponse {
  items: Array<Pick<NftSummary, "id" | "name" | "image" | "price" | "creator">>;
}

// ---------------------------------------------------------------------------
// Sessão e conta
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: ISODate;
}

export interface Session {
  token: string;
  expiresAt: ISODate;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface UpdateProfileRequest {
  displayName: string;
  handle: string;
  email: string;
  bio: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export interface FavoritesResponse {
  nftIds: string[];
}

// ---------------------------------------------------------------------------
// Carrinho e cotação
// ---------------------------------------------------------------------------

export interface CartItem {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
  name: string;
  tokenId: string;
  imageSmall: string;
  editionLabel: string;
  network: Network;
  /** Preço unitário atual (catálogo) */
  unitPrice: Decimal;
  /** Preço unitário quando o item foi adicionado */
  priceAtAdd: Decimal;
  available: number;
  maxPerOrder: number;
}

export interface Cart {
  id: string;
  ownerType: "guest" | "user";
  items: CartItem[];
  couponCode: string | null;
  version: number;
  updatedAt: ISODate;
}

export interface AddCartItemRequest {
  nftId: string;
  editionId: string;
  quantity: number;
}

export type QuoteIssue =
  | { type: "PRICE_CHANGED"; itemId: string; from: Decimal; to: Decimal }
  | {
      type: "INSUFFICIENT_AVAILABILITY";
      itemId: string;
      requested: number;
      available: number;
    }
  | { type: "COUPON_EXPIRED"; code: string }
  | { type: "COUPON_INVALID"; code: string };

export interface QuoteLine {
  itemId: string;
  nftId: string;
  editionId: string;
  name: string;
  editionLabel: string;
  imageSmall: string;
  tokenId: string;
  quantity: number;
  unitPrice: Decimal;
  lineTotal: Decimal;
}

export interface Quote {
  /** Identificador determinístico do conteúdo da cotação (muda se qualquer valor mudar) */
  hash: string;
  cartVersion: number;
  network: Network;
  lines: QuoteLine[];
  subtotal: Decimal;
  discount: Decimal;
  networkFee: Decimal;
  total: Decimal;
  coupon: { code: string; percent: number } | null;
  issues: QuoteIssue[];
  /** true quando não há problemas que impeçam o pedido */
  purchasable: boolean;
  quotedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const WALLET_PROVIDERS = [
  "metamask",
  "walletconnect",
  "coinbase",
  "phantom",
] as const;
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];
export type WalletRole = "primary" | "secondary";

export interface Wallet {
  id: string;
  role: WalletRole;
  label: string;
  provider: WalletProvider;
  address: string;
  networks: Network[];
  updatedAt: ISODate;
}

export interface WalletInput {
  role: WalletRole;
  label: string;
  provider: WalletProvider;
  address: string;
  networks: Network[];
}

export interface WalletConnection {
  walletId: string;
  network: Network;
  status: "connected";
  connectionId: string;
  connectedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type OrderStatus = "pending" | "confirmed" | "declined";
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["confirmed", "declined"];

export interface CollectorInfo {
  fullName: string;
  email: string;
  country: string;
  document: string;
}

export interface CreateOrderRequest {
  quoteHash: string;
  network: Network;
  walletId: string;
  connectionId: string;
  collector: CollectorInfo;
}

export interface OrderReceipt {
  lines: QuoteLine[];
  subtotal: Decimal;
  discount: Decimal;
  networkFee: Decimal;
  total: Decimal;
  coupon: { code: string; percent: number } | null;
}

export interface Order {
  id: string;
  number: string;
  userId: string;
  status: OrderStatus;
  network: Network;
  wallet: Pick<Wallet, "id" | "label" | "address" | "provider">;
  collector: CollectorInfo;
  /** Snapshot imutável do pedido no momento da criação */
  receipt: OrderReceipt;
  txHash: string | null;
  explorerUrl: string | null;
  declineReason: string | null;
  version: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Eventos Socket.IO
// ---------------------------------------------------------------------------

export interface EventEnvelope<
  TType extends string,
  TResource extends string,
  TData,
> {
  /** Identidade estável do evento (dedupe) */
  id: string;
  type: TType;
  resource: { type: TResource; id: string };
  /** Versão do recurso após o evento (ordenação / descarte de eventos antigos) */
  version: number;
  occurredAt: ISODate;
  data: TData;
}

export type NftUpdatedEvent = EventEnvelope<
  "nft.updated",
  "nft",
  {
    price: Decimal;
    previousPrice: Decimal | null;
    soldOut: boolean;
    editions: Array<Pick<Edition, "id" | "price" | "available">>;
  }
>;

export type OrderUpdatedEvent = EventEnvelope<
  "order.updated",
  "order",
  { userId: string; status: OrderStatus; order: Order }
>;

export interface ServerToClientEvents {
  "nft.updated": (event: NftUpdatedEvent) => void;
  "order.updated": (event: OrderUpdatedEvent) => void;
  "session.ready": (payload: { userId: string | null }) => void;
}

export interface ClientToServerEvents {
  "session.identify": (payload: { token: string | null }) => void;
}

// ---------------------------------------------------------------------------
// Controle de cenários (apenas camada de mocks)
// ---------------------------------------------------------------------------

export type LatencyProfile =
  | "none"
  | "fast"
  | "realistic"
  | "slow"
  | "out-of-order";
export type FaultKind =
  | "http-500"
  | "http-503"
  | "http-401"
  | "http-403"
  | "offline"
  | "timeout"
  | "timeout-after-commit";

export interface FaultRule {
  /** "METHOD /api/path" com * como curinga, ex.: "PUT /api/favorites/*" */
  route: string;
  kind: FaultKind;
  /** Quantas vezes a falha ocorre (0 = sempre) */
  times: number;
}

export interface MockScenario {
  latency: LatencyProfile;
  catalog: "default" | "empty";
  payment: "approve" | "decline";
  walletConnect: "approve" | "reject";
  /** Tempo até a liquidação simulada do pedido; null = manual via /__dev */
  settleDelayMs: number | null;
  sessionTtlMinutes: number;
  faults: FaultRule[];
}
