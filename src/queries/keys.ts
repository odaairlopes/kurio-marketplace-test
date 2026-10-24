import type { CatalogQuery, Network } from "@/api/contracts";

/**
 * Chaves de cache. Dados privados ficam sob ['user', userId, ...] e o carrinho
 * sob ['cart', ownerKey, ...] — o isolamento por usuário vem da própria chave.
 */
export const keys = {
  nfts: ["nfts"] as const,
  catalog: (query: CatalogQuery) => ["nfts", "list", query] as const,
  catalogAll: ["nfts", "list"] as const,
  featured: ["nfts", "featured"] as const,
  nft: (id: string) => ["nfts", "detail", id] as const,

  user: (userId: string) => ["user", userId] as const,
  favorites: (userId: string) => ["user", userId, "favorites"] as const,
  profile: (userId: string) => ["user", userId, "profile"] as const,
  wallets: (userId: string) => ["user", userId, "wallets"] as const,
  orders: (userId: string) => ["user", userId, "orders"] as const,
  order: (userId: string, orderId: string) =>
    ["user", userId, "orders", orderId] as const,

  cart: (owner: string) => ["cart", owner] as const,
  quote: (owner: string, network: Network) =>
    ["cart", owner, "quote", network] as const,
};
