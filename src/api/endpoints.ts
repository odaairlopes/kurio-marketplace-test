/** Funções tipadas por recurso. Toda chamada REST passa pelo Axios (`request`). */
import type {
  AddCartItemRequest,
  Cart,
  CatalogQuery,
  CatalogResponse,
  ChangePasswordRequest,
  CreateOrderRequest,
  FavoritesResponse,
  FeaturedResponse,
  LoginRequest,
  Network,
  NftDetail,
  Order,
  Quote,
  RegisterRequest,
  Session,
  UpdateProfileRequest,
  User,
  Wallet,
  WalletConnection,
  WalletInput,
} from "./contracts";
import { request } from "./http";

type Signal = { signal?: AbortSignal };

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<Session>({ method: "POST", url: "/auth/login", data: body }),
    register: (body: RegisterRequest) =>
      request<Session>({ method: "POST", url: "/auth/register", data: body }),
    session: ({ signal }: Signal = {}) =>
      request<Session>({ method: "GET", url: "/auth/session", signal }),
    logout: () => request<void>({ method: "POST", url: "/auth/logout" }),
  },

  nfts: {
    list: (query: CatalogQuery, { signal }: Signal = {}) =>
      request<CatalogResponse>({
        method: "GET",
        url: "/nfts",
        signal,
        params: {
          q: query.q || undefined,
          collections: query.collections?.length
            ? query.collections.join(",")
            : undefined,
          networks: query.networks?.length
            ? query.networks.join(",")
            : undefined,
          minPrice: query.minPrice || undefined,
          maxPrice: query.maxPrice || undefined,
          tab: query.tab,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),
    featured: ({ signal }: Signal = {}) =>
      request<FeaturedResponse>({
        method: "GET",
        url: "/nfts/featured",
        signal,
      }),
    detail: (id: string, { signal }: Signal = {}) =>
      request<NftDetail>({
        method: "GET",
        url: `/nfts/${encodeURIComponent(id)}`,
        signal,
      }),
  },

  favorites: {
    list: ({ signal }: Signal = {}) =>
      request<FavoritesResponse>({ method: "GET", url: "/favorites", signal }),
    add: (nftId: string) =>
      request<FavoritesResponse>({
        method: "PUT",
        url: `/favorites/${encodeURIComponent(nftId)}`,
      }),
    remove: (nftId: string) =>
      request<FavoritesResponse>({
        method: "DELETE",
        url: `/favorites/${encodeURIComponent(nftId)}`,
      }),
  },

  cart: {
    get: ({ signal }: Signal = {}) =>
      request<Cart>({ method: "GET", url: "/cart", signal }),
    addItem: (body: AddCartItemRequest) =>
      request<Cart>({ method: "POST", url: "/cart/items", data: body }),
    updateItem: (
      itemId: string,
      body: { quantity?: number; acceptPrice?: boolean },
    ) =>
      request<Cart>({
        method: "PATCH",
        url: `/cart/items/${itemId}`,
        data: body,
      }),
    removeItem: (itemId: string) =>
      request<Cart>({ method: "DELETE", url: `/cart/items/${itemId}` }),
    applyCoupon: (code: string) =>
      request<Cart>({ method: "PUT", url: "/cart/coupon", data: { code } }),
    removeCoupon: () =>
      request<Cart>({ method: "DELETE", url: "/cart/coupon" }),
    merge: (guestCartId: string) =>
      request<Cart>({
        method: "POST",
        url: "/cart/merge",
        data: { guestCartId },
      }),
    quote: (network: Network, { signal }: Signal = {}) =>
      request<Quote>({
        method: "GET",
        url: "/cart/quote",
        params: { network },
        signal,
      }),
  },

  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<Order>({
        method: "POST",
        url: "/orders",
        data: body,
        headers: { "Idempotency-Key": idempotencyKey },
        timeout: 6_000,
      }),
    get: (id: string, { signal }: Signal = {}) =>
      request<Order>({ method: "GET", url: `/orders/${id}`, signal }),
    list: ({ signal }: Signal = {}) =>
      request<{ items: Order[] }>({ method: "GET", url: "/orders", signal }),
  },

  profile: {
    get: ({ signal }: Signal = {}) =>
      request<User>({ method: "GET", url: "/profile", signal }),
    update: (body: UpdateProfileRequest) =>
      request<User>({ method: "PATCH", url: "/profile", data: body }),
    uploadAvatar: (file: Blob, filename: string) => {
      const form = new FormData();
      form.append("avatar", file, filename);
      return request<User>({
        method: "POST",
        url: "/profile/avatar",
        data: form,
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    removeAvatar: () =>
      request<User>({ method: "DELETE", url: "/profile/avatar" }),
    changePassword: (body: ChangePasswordRequest) =>
      request<void>({ method: "PUT", url: "/profile/password", data: body }),
  },

  wallets: {
    list: ({ signal }: Signal = {}) =>
      request<{ items: Wallet[] }>({ method: "GET", url: "/wallets", signal }),
    create: (body: WalletInput) =>
      request<Wallet>({ method: "POST", url: "/wallets", data: body }),
    update: (id: string, body: WalletInput) =>
      request<Wallet>({ method: "PUT", url: `/wallets/${id}`, data: body }),
    connect: (id: string, network: Network) =>
      request<WalletConnection>({
        method: "POST",
        url: `/wallets/${id}/connect`,
        data: { network },
      }),
    disconnect: (connectionId: string) =>
      request<void>({
        method: "DELETE",
        url: `/wallet-connections/${connectionId}`,
      }),
  },

  dev: {
    scenario: () =>
      request<{
        scenario: import("./contracts").MockScenario;
        presets: string[];
      }>({ method: "GET", url: "/__dev/scenario" }),
    updateScenario: (body: Partial<import("./contracts").MockScenario>) =>
      request({ method: "PUT", url: "/__dev/scenario", data: body }),
    preset: (name: string) =>
      request({ method: "POST", url: `/__dev/preset/${name}` }),
    fault: (rule: import("./contracts").FaultRule) =>
      request({ method: "POST", url: "/__dev/faults", data: rule }),
    clearFaults: () => request({ method: "DELETE", url: "/__dev/faults" }),
    reset: () => request({ method: "POST", url: "/__dev/reset" }),
    updateNft: (
      id: string,
      body: { editionId?: string; price?: string; available?: number },
    ) =>
      request({ method: "POST", url: `/__dev/nfts/${id}/update`, data: body }),
    replayLast: () =>
      request({ method: "POST", url: "/__dev/events/replay-last" }),
    staleEvent: (id: string) =>
      request({
        method: "POST",
        url: `/__dev/nfts/${id}/stale-event`,
        data: {},
      }),
    dropSocket: (offlineMs: number) =>
      request({
        method: "POST",
        url: "/__dev/socket/drop",
        data: { offlineMs },
      }),
    expireSessions: () =>
      request({ method: "POST", url: "/__dev/sessions/expire" }),
  },
};
