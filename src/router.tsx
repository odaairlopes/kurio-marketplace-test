import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import {
  CATALOG_TABS,
  type CatalogTab,
  SORT_OPTIONS,
  type SortOption,
} from "@/api/contracts";
import { RootLayout } from "@/components/layout/RootLayout";
import { NotFound, RouteError } from "@/components/states";
import { api } from "@/api/endpoints";
import { ApiError } from "@/api/http";
import { sessionStore } from "@/lib/session";
import { HomePage } from "@/pages/HomePage";

export interface RouterContext {
  queryClient: QueryClient;
}

// ---------------------------------------------------------------------------
// Parâmetros de busca (estado da URL)
// ---------------------------------------------------------------------------

export interface HomeSearch {
  q?: string;
  collections?: string;
  networks?: string;
  minPrice?: string;
  maxPrice?: string;
  tab?: CatalogTab;
  sort?: SortOption;
  page?: number;
}

const str = (v: unknown) =>
  typeof v === "string" && v.trim()
    ? v.trim()
    : typeof v === "number"
      ? String(v)
      : undefined;

export function validateHomeSearch(
  search: Record<string, unknown>,
): HomeSearch {
  const page = Number(search.page);
  const tab = str(search.tab);
  const sort = str(search.sort);
  return {
    q: str(search.q),
    collections: str(search.collections),
    networks: str(search.networks),
    minPrice: str(search.minPrice),
    maxPrice: str(search.maxPrice),
    tab:
      tab && (CATALOG_TABS as readonly string[]).includes(tab) && tab !== "all"
        ? (tab as CatalogTab)
        : undefined,
    sort:
      sort &&
      (SORT_OPTIONS as readonly string[]).includes(sort) &&
      sort !== "recent"
        ? (sort as SortOption)
        : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

export interface AuthSearch {
  redirect?: string;
  reason?: "expired";
}

/** Aceita apenas caminhos internos como destino de retorno (evita open redirect). */
function safeRedirect(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : undefined;
}

const validateAuthSearch = (search: Record<string, unknown>): AuthSearch => ({
  redirect: safeRedirect(search.redirect),
  reason: search.reason === "expired" ? "expired" : undefined,
});

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
});

/** Protege rotas privadas preservando o destino para retomada após o login. */
async function requireAuth({
  location,
  context,
}: {
  location: { href: string };
  context: RouterContext;
}) {
  const session = sessionStore.get();
  if (!session) {
    throw redirect({
      to: "/login",
      search: {
        redirect: location.href,
        reason: sessionStore.wasExpired() ? "expired" : undefined,
      },
    });
  }
  // Revalida a sessão ao entrar em rotas privadas (cache curto): uma sessão
  // expirada no servidor é detectada durante a navegação, não só no próximo erro.
  try {
    await context.queryClient.fetchQuery({
      queryKey: ["session", session.token],
      queryFn: () => api.auth.session(),
      staleTime: 15_000,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href, reason: "expired" },
      });
    }
  }
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: validateHomeSearch,
  component: HomePage,
  errorComponent: RouteError,
});

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nft/$nftId",
  component: lazyRouteComponent(() => import("@/pages/NftPage"), "NftPage"),
  errorComponent: RouteError,
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: lazyRouteComponent(() => import("@/pages/CartPage"), "CartPage"),
  errorComponent: RouteError,
});

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkout",
  beforeLoad: requireAuth,
  component: lazyRouteComponent(
    () => import("@/pages/CheckoutPage"),
    "CheckoutPage",
  ),
  errorComponent: RouteError,
});

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId",
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import("@/pages/OrderPage"), "OrderPage"),
  errorComponent: RouteError,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(() => import("@/pages/AuthPages"), "LoginPage"),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(
    () => import("@/pages/AuthPages"),
    "RegisterPage",
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  beforeLoad: requireAuth,
  component: lazyRouteComponent(
    () => import("@/pages/ProfilePage"),
    "ProfilePage",
  ),
  errorComponent: RouteError,
});

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wallets",
  beforeLoad: requireAuth,
  component: lazyRouteComponent(
    () => import("@/pages/WalletsPage"),
    "WalletsPage",
  ),
  errorComponent: RouteError,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  walletsRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Query string legível (sem JSON): ?collections=a,b&maxPrice=2&page=3
    parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
    stringifySearch: (search) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(search))
        if (value !== undefined && value !== null && value !== "")
          params.set(key, String(value));
      const out = params.toString();
      return out ? `?${out}` : "";
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

export { homeRoute, nftRoute, orderRoute, loginRoute, registerRoute };
