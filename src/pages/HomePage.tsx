import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CatalogQuery,
  CatalogTab,
  CollectionId,
  Network,
  SortOption,
} from "@/api/contracts";
import { COLLECTIONS, NETWORKS } from "@/api/contracts";
import { Filters, type FilterState } from "@/components/catalog/Filters";
import { NftCard, NftCardSkeleton } from "@/components/catalog/NftCard";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";
import { formatEth } from "@/lib/money";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn, COLLECTION_LABEL, NETWORK_LABEL } from "@/lib/utils";
import {
  CATALOG_PAGE_SIZE,
  catalogQuery,
  featuredQuery,
} from "@/queries/catalog";
import type { HomeSearch } from "@/router";

const route = getRouteApi("/");

const SORT_LABEL: Record<SortOption, string> = {
  recent: "Listados recentemente",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  popular: "Mais populares",
  rating: "Melhor avaliados",
};

const TAB_LABEL: Record<CatalogTab, string> = {
  all: "Todos os NFTs",
  new: "Novos lançamentos",
  trending: "Em alta",
};

const HERO_SLIDES = [
  {
    image: "/nft/hero.webp",
    alt: "Arte generativa em destaque com anéis concêntricos em tons quentes",
  },
  {
    image: "/nft/hero-2.webp",
    alt: "Retrato abstrato em destaque com formas e cores vibrantes",
  },
];

function splitList<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T[] {
  return (value?.split(",") ?? []).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );
}

export function toCatalogQuery(search: HomeSearch): CatalogQuery {
  return {
    q: search.q,
    collections: splitList<CollectionId>(search.collections, COLLECTIONS),
    networks: splitList<Network>(search.networks, NETWORKS),
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab ?? "all",
    sort: search.sort ?? "recent",
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  };
}

function scrollToCatalog() {
  document.getElementById("catalogo")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function Hero() {
  const [slide, setSlide] = useState(0);
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_120%_at_0%_0%,#38220F_0%,#241612_45%,#140D0A_100%)]"
    >
      <div className="grid items-center gap-6 p-6 md:min-h-112.5 md:grid-cols-[minmax(0,1fr)_300px] md:p-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-14">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent-text">
            Bem-vindo à Kurio
          </p>
          <h1
            id="hero-title"
            className="text-[28px] font-bold uppercase leading-tight text-fg-strong md:text-display"
          >
            <span className="md:hidden">Own digital culture</span>
            <span className="hidden md:inline">
              Own the future of digital art
            </span>
          </h1>
          <p className="max-w-md text-sm leading-6 text-fg-muted md:text-base md:leading-7">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <Button size="lg" className="self-start" onClick={scrollToCatalog}>
            Explorar
          </Button>
        </div>
        <div className="relative mx-auto w-full max-w-60 md:max-w-105">
          <img
            src={HERO_SLIDES[slide].image}
            alt={HERO_SLIDES[slide].alt}
            width={560}
            height={560}
            fetchPriority="high"
            className="aspect-square w-full rounded-xl border border-line-soft object-cover shadow-2xl"
          />
          <div
            className="mt-4 flex justify-center gap-2"
            role="group"
            aria-label="Destaques"
          >
            {HERO_SLIDES.map((s, i) => (
              <button
                key={s.image}
                type="button"
                aria-label={`Mostrar destaque ${i + 1} de ${HERO_SLIDES.length}`}
                aria-pressed={slide === i}
                onClick={() => setSlide(i)}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    slide === i ? "w-6 bg-accent-text" : "w-1.5 bg-line-soft",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedBanner() {
  const featured = useQuery(featuredQuery());
  const item = featured.data?.items[0];
  return (
    <aside
      aria-labelledby="featured-title"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      {item ? (
        <Link
          to="/nft/$nftId"
          params={{ nftId: item.id }}
          className="group block"
        >
          <img
            src={item.image.replace(".webp", "-sm.webp")}
            alt={`Arte do NFT ${item.name}`}
            width={320}
            height={320}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
          <div className="flex flex-col gap-1 p-5">
            <Badge className="self-start">Oferta limitada</Badge>
            <p
              id="featured-title"
              className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-text"
            >
              NFT em destaque
            </p>
            <p className="font-bold group-hover:text-accent-text">
              {item.name}
            </p>
            <p className="text-sm text-fg-muted">{formatEth(item.price)}</p>
          </div>
        </Link>
      ) : (
        <div aria-hidden>
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <span id="featured-title" className="sr-only">
            NFT em destaque
          </span>
        </div>
      )}
    </aside>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (q: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setDraft(value);
      last.current = value;
    }
  }, [value]);
  useEffect(() => {
    if (draft === last.current) return;
    const timer = setTimeout(() => {
      last.current = draft;
      onChange(draft);
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, onChange]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        last.current = draft;
        onChange(draft);
      }}
      className="relative"
    >
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs por nome, criador ou token
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
      <Input
        id="catalog-search"
        type="search"
        placeholder="Buscar NFTs, criadores…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="pl-9"
        autoComplete="off"
      />
    </form>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Paginação do catálogo"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft aria-hidden />
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "ghost"}
          size="sm"
          aria-current={p === page ? "page" : undefined}
          aria-label={`Página ${p}`}
          onClick={() => onPage(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Próxima página"
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}

export function HomePage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const query = useMemo(() => toCatalogQuery(search), [search]);
  const catalog = useQuery(catalogQuery(query));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const filterState: FilterState = {
    collections: query.collections ?? [],
    networks: query.networks ?? [],
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  };

  /** Toda mudança de filtro/busca/aba/ordenação reinicia a paginação. */
  const setSearch = (patch: Partial<HomeSearch>, replace = false) =>
    navigate({
      search: (prev: HomeSearch) => ({
        ...prev,
        ...patch,
        page: "page" in patch ? patch.page : undefined,
      }),
      replace,
      resetScroll: false,
    });

  const applyFilters = (next: FilterState) =>
    setSearch({
      collections: next.collections.length
        ? next.collections.join(",")
        : undefined,
      networks: next.networks.length ? next.networks.join(",") : undefined,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
    });

  const activeChips = [
    ...filterState.collections.map((c) => ({
      key: `c-${c}`,
      label: COLLECTION_LABEL[c],
      remove: () =>
        applyFilters({
          ...filterState,
          collections: filterState.collections.filter((x) => x !== c),
        }),
    })),
    ...filterState.networks.map((n) => ({
      key: `n-${n}`,
      label: NETWORK_LABEL[n],
      remove: () =>
        applyFilters({
          ...filterState,
          networks: filterState.networks.filter((x) => x !== n),
        }),
    })),
    ...(filterState.minPrice || filterState.maxPrice
      ? [
          {
            key: "price",
            label: `${filterState.minPrice ?? "0"} – ${filterState.maxPrice ?? "∞"} ETH`,
            remove: () =>
              applyFilters({
                ...filterState,
                minPrice: undefined,
                maxPrice: undefined,
              }),
          },
        ]
      : []),
    ...(query.q
      ? [
          {
            key: "q",
            label: `“${query.q}”`,
            remove: () => setSearch({ q: undefined }),
          },
        ]
      : []),
  ];
  const filterCount =
    filterState.collections.length +
    filterState.networks.length +
    (filterState.minPrice || filterState.maxPrice ? 1 : 0);

  const data = catalog.data;
  const isUpdating = catalog.isFetching && catalog.isPlaceholderData;

  return (
    <div className="container-kurio flex flex-col gap-10 pt-6 md:gap-24">
      {/* Mobile: busca acima do hero, como no frame mobile */}
      {!isDesktop && (
        <SearchBox
          value={query.q ?? ""}
          onChange={(q) => setSearch({ q: q || undefined }, true)}
        />
      )}

      <Hero />

      <section
        id="catalogo"
        aria-labelledby="catalog-title"
        className="scroll-mt-6"
      >
        <h2 id="catalog-title" className="sr-only">
          Catálogo
        </h2>
        {!isDesktop && (
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Explorar coleções</h2>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Filtros${filterCount ? `, ${filterCount} ativos` : ""}`}
                >
                  <SlidersHorizontal aria-hidden /> Filtros{" "}
                  {filterCount > 0 && <Badge>{filterCount}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetTitle className="text-lg font-bold">Filtros</SheetTitle>
                <SheetDescription className="sr-only">
                  Filtre o catálogo por coleção, preço e rede.
                </SheetDescription>
                <Filters
                  value={filterState}
                  facets={data?.facets}
                  onChange={applyFilters}
                  idPrefix="mf"
                />
                <Button onClick={() => setFiltersOpen(false)}>
                  Ver {data?.total ?? ""} resultados
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
          {isDesktop && (
            <div className="flex flex-col gap-10">
              <h2 className="sr-only">Filtros</h2>
              <div className="rounded-xl border border-line p-5">
                <div className="mb-8">
                  <SearchBox
                    value={query.q ?? ""}
                    onChange={(q) => setSearch({ q: q || undefined }, true)}
                  />
                </div>
                <Filters
                  value={filterState}
                  facets={data?.facets}
                  onChange={applyFilters}
                  idPrefix="df"
                />
              </div>
              <FeaturedBanner />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-col gap-4 border-b border-line pb-px xl:flex-row xl:items-end xl:justify-between">
              {/* Botões de alternância (não há painéis distintos: as seções filtram a mesma lista) */}
              <div
                role="group"
                aria-label="Seções do catálogo"
                className="flex max-w-full items-center gap-6 overflow-x-auto"
              >
                {(Object.keys(TAB_LABEL) as CatalogTab[]).map((tab) => {
                  const active = query.tab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSearch({ tab: tab === "all" ? undefined : tab })
                      }
                      className={cn(
                        "relative whitespace-nowrap py-2 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full hover:text-fg",
                        active
                          ? "font-bold text-accent-text after:bg-accent-text"
                          : "text-fg-muted after:bg-transparent",
                      )}
                    >
                      {TAB_LABEL[tab]}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pb-2">
                <span className="text-sm text-fg-muted" id="sort-label">
                  Ordenar por:
                </span>
                <Select
                  value={query.sort}
                  onValueChange={(sort) =>
                    setSearch({
                      sort:
                        sort === "recent" ? undefined : (sort as SortOption),
                    })
                  }
                >
                  <SelectTrigger
                    className="h-9 w-55 border-none bg-transparent px-1 font-bold text-accent-text"
                    aria-labelledby="sort-label"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(Object.keys(SORT_LABEL) as SortOption[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SORT_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex min-h-8 flex-wrap items-center gap-2">
              <p
                role="status"
                aria-live="polite"
                className="mr-2 text-sm text-fg-muted"
                data-testid="results-status"
              >
                {catalog.isPending
                  ? "Carregando NFTs…"
                  : isUpdating
                    ? "Atualizando resultados…"
                    : data
                      ? `${data.total} ${data.total === 1 ? "resultado" : "resultados"}`
                      : ""}
              </p>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.remove}
                  className="flex items-center gap-1 rounded-full border border-line-soft px-3 py-1 text-xs hover:border-accent-text"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  {chip.label} <X className="size-3" aria-hidden />
                </button>
              ))}
              {activeChips.length > 1 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate({ search: {}, resetScroll: false })}
                >
                  Limpar tudo
                </Button>
              )}
            </div>

            <div className="mt-6">
              {catalog.isPending ? (
                <ul
                  className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3 lg:gap-8.5"
                  aria-busy="true"
                  aria-label="Carregando catálogo"
                >
                  {Array.from({ length: CATALOG_PAGE_SIZE }).map((_, i) => (
                    <li key={i}>
                      <NftCardSkeleton />
                    </li>
                  ))}
                </ul>
              ) : catalog.isError && !data ? (
                <ErrorState
                  error={catalog.error}
                  onRetry={() => void catalog.refetch()}
                  title="Não foi possível carregar o catálogo"
                />
              ) : data && data.items.length === 0 ? (
                <EmptyState
                  title="Nenhum NFT encontrado"
                  description="Tente remover filtros ou buscar por outro termo."
                  action={
                    activeChips.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate({ search: {}, resetScroll: false })
                        }
                      >
                        Limpar filtros
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  {catalog.isError && (
                    <p role="alert" className="mb-4 text-sm text-danger">
                      Falha ao atualizar: {catalog.error.message}{" "}
                      <button
                        className="underline"
                        onClick={() => void catalog.refetch()}
                      >
                        Tentar novamente
                      </button>
                    </p>
                  )}
                  <ul
                    className={cn(
                      "grid grid-cols-2 gap-4 transition-opacity md:gap-6 lg:grid-cols-3 lg:gap-8.5",
                      isUpdating && "opacity-60",
                    )}
                    aria-busy={isUpdating}
                  >
                    {data?.items.map((nft, i) => (
                      <li key={nft.id}>
                        <NftCard nft={nft} priority={i < 3} />
                      </li>
                    ))}
                  </ul>
                  {data && (
                    <Pagination
                      page={data.page}
                      totalPages={data.totalPages}
                      onPage={(p) => {
                        void setSearch({ page: p > 1 ? p : undefined });
                        scrollToCatalog();
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
