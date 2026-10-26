import { HttpResponse } from "msw";
import type {
  CatalogResponse,
  CatalogTab,
  CollectionId,
  FavoritesResponse,
  FeaturedResponse,
  Network,
  SortOption,
} from "@/api/contracts";
import { COLLECTIONS, NETWORKS } from "@/api/contracts";
import { cmp, parseDecimalInput } from "@/lib/money";
import { db, findNft, persist } from "../db";
import { errorResponse, scenario } from "../scenario";
import { nftPrice, toDetail, toSummary } from "../serializers";
import { requireAuth, route } from "./utils";

function list<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  if (!value) return [];
  return value
    .split(",")
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export const catalogHandlers = [
  route("get", "/nfts/featured", () => {
    const items = db.state.nfts
      .filter((n) => n.trending)
      .slice(0, 3)
      .map((n) => ({
        id: n.id,
        name: n.name,
        image: n.images[0],
        price: nftPrice(n),
        creator: n.creator,
      }));
    return HttpResponse.json<FeaturedResponse>({ items });
  }),

  route("get", "/nfts", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const collections = list<CollectionId>(
      url.searchParams.get("collections"),
      COLLECTIONS,
    );
    const networks = list<Network>(url.searchParams.get("networks"), NETWORKS);
    const minPrice = parseDecimalInput(url.searchParams.get("minPrice") ?? "");
    const maxPrice = parseDecimalInput(url.searchParams.get("maxPrice") ?? "");
    const tab = (url.searchParams.get("tab") ?? "all") as CatalogTab;
    const sort = (url.searchParams.get("sort") ?? "recent") as SortOption;
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
    );
    const pageSize = Math.min(
      48,
      Math.max(
        1,
        Number.parseInt(url.searchParams.get("pageSize") ?? "9", 10) || 9,
      ),
    );

    const source = scenario.current.catalog === "empty" ? [] : db.state.nfts;

    const matchesText = (n: (typeof source)[number]) =>
      !q ||
      n.name.toLowerCase().includes(q) ||
      n.creator.toLowerCase().includes(q) ||
      n.tokenId.toLowerCase().includes(q);
    const matchesTab = (n: (typeof source)[number]) =>
      tab === "all" || (tab === "new" ? n.isNew : n.trending);
    const matchesPrice = (n: (typeof source)[number]) => {
      const price = nftPrice(n);
      if (minPrice && cmp(price, minPrice) < 0) return false;
      if (maxPrice && cmp(price, maxPrice) > 0) return false;
      return true;
    };
    const base = source.filter((n) => matchesText(n) && matchesTab(n));

    // Facetas: contagem de cada opção considerando os demais filtros aplicados.
    const facetCollections = COLLECTIONS.map((id) => ({
      id,
      count: base.filter(
        (n) =>
          n.collection === id &&
          matchesPrice(n) &&
          (!networks.length || networks.includes(n.network)),
      ).length,
    }));
    const facetNetworks = NETWORKS.map((id) => ({
      id,
      count: base.filter(
        (n) =>
          n.network === id &&
          matchesPrice(n) &&
          (!collections.length || collections.includes(n.collection)),
      ).length,
    }));

    const filtered = base.filter(
      (n) =>
        matchesPrice(n) &&
        (!collections.length || collections.includes(n.collection)) &&
        (!networks.length || networks.includes(n.network)),
    );

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return cmp(nftPrice(a), nftPrice(b)) || a.id.localeCompare(b.id);
        case "price-desc":
          return cmp(nftPrice(b), nftPrice(a)) || a.id.localeCompare(b.id);
        case "popular":
          return b.popularity - a.popularity;
        case "rating":
          return (
            b.rating.average - a.rating.average ||
            b.rating.count - a.rating.count
          );
        default:
          return b.listedAt.localeCompare(a.listedAt);
      }
    });

    const prices = source.map(nftPrice).sort((a, b) => cmp(a, b));
    // Estado inicial (sem busca/filtros): exibe as contagens e a faixa de preço
    // do layout do Figma; com qualquer filtro, voltam a ser as contagens reais.
    const pristine =
      !q &&
      !collections.length &&
      !networks.length &&
      !minPrice &&
      !maxPrice &&
      tab === "all" &&
      scenario.current.catalog !== "empty";
    if (pristine) {
      const FIGMA_COLLECTION_COUNTS = [33, 12, 65, 39, 23, 17, 19, 13, 18];
      const FIGMA_NETWORK_COUNTS = [119, 78, 86];
      facetCollections.forEach((f, i) => {
        f.count = FIGMA_COLLECTION_COUNTS[i] ?? f.count;
      });
      facetNetworks.forEach((f, i) => {
        f.count = FIGMA_NETWORK_COUNTS[i] ?? f.count;
      });
    }
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const body: CatalogResponse = {
      items: sorted
        .slice((page - 1) * pageSize, page * pageSize)
        .map(toSummary),
      page,
      pageSize,
      total,
      totalPages,
      facets: {
        collections: facetCollections,
        networks: facetNetworks,
        priceRange: {
          min: pristine ? "0.02" : (prices[0] ?? "0"),
          max: pristine ? "12.30" : (prices[prices.length - 1] ?? "0"),
        },
      },
    };
    return HttpResponse.json(body);
  }),

  route<{ id: string }>("get", "/nfts/:id", ({ params }) => {
    const nft = findNft(params.id);
    if (!nft || scenario.current.catalog === "empty")
      return errorResponse(404, "NOT_FOUND", "NFT não encontrado.");
    return HttpResponse.json(toDetail(nft));
  }),

  // Favoritos -----------------------------------------------------------------
  route("get", "/favorites", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json<FavoritesResponse>({
      nftIds: db.state.favorites[auth.userId] ?? [],
    });
  }),

  route<{ nftId: string }>(
    "put",
    "/favorites/:nftId",
    ({ request, params }) => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      if (!findNft(params.nftId))
        return errorResponse(404, "NOT_FOUND", "NFT não encontrado.");
      const current = db.state.favorites[auth.userId] ?? [];
      if (!current.includes(params.nftId))
        db.state.favorites[auth.userId] = [...current, params.nftId];
      persist();
      return HttpResponse.json<FavoritesResponse>({
        nftIds: db.state.favorites[auth.userId],
      });
    },
  ),

  route<{ nftId: string }>(
    "delete",
    "/favorites/:nftId",
    ({ request, params }) => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      db.state.favorites[auth.userId] = (
        db.state.favorites[auth.userId] ?? []
      ).filter((id) => id !== params.nftId);
      persist();
      return HttpResponse.json<FavoritesResponse>({
        nftIds: db.state.favorites[auth.userId],
      });
    },
  ),
];
