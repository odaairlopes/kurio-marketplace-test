import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
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
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, NativeSelect } from "@/components/ui/input";
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
    art: "glasses",
    alt: "Macaco de óculos redondos e jaqueta esportiva verde, em retrato ilustrado",
  },
  {
    art: "hat",
    alt: "Gorila de chapéu bucket verde e moletom roxo, em retrato ilustrado",
  },
  {
    art: "turtleneck",
    alt: "Chimpanzé de blazer bege e gola alta verde, em retrato ilustrado",
  },
];

/** srcset da arte do hero (400 px para o card mobile, 800 px para desktop/telas 2x). */
function heroSrc(art: string) {
  return {
    src: `/nft/ape-${art}.webp`,
    srcSet: `/nft/ape-${art}-sm.webp 400w, /nft/ape-${art}.webp 800w`,
  };
}

function HeroDots({
  slide,
  onSelect,
  className,
}: {
  slide: number;
  onSelect: (i: number) => void;
  className?: string;
}) {
  return (
    <div className={className} role="group" aria-label="Destaques">
      {HERO_SLIDES.map((s, i) => (
        <button
          key={s.art}
          type="button"
          aria-label={`Mostrar destaque ${i + 1} de ${HERO_SLIDES.length}`}
          aria-pressed={slide === i}
          onClick={() => onSelect(i)}
          className="flex size-5 items-center justify-center"
        >
          <span
            className={cn(
              "size-2 rounded-full bg-brand transition-opacity",
              slide === i ? "opacity-100" : "opacity-55",
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** Hero do frame mobile: card com gradiente, arte principal e miniatura sobreposta. */
function MobileHero() {
  const [slide, setSlide] = useState(0);
  const current = HERO_SLIDES[slide];
  const next = HERO_SLIDES[(slide + 1) % HERO_SLIDES.length];
  return (
    <section
      aria-labelledby="hero-title"
      className="relative h-[190px] overflow-hidden rounded-[30px] bg-[linear-gradient(153deg,rgb(210_138_76/0.2)_0%,rgb(210_138_76/0.1)_100%)]"
    >
      <span
        aria-hidden
        className="absolute left-[-80px] top-[-31px] size-62 rounded-full bg-[linear-gradient(160deg,rgb(221_154_95/0.43)_0%,rgb(210_138_76/0.04)_100%)]"
      />
      <span
        aria-hidden
        className="absolute left-[73px] top-[-10px] size-62 rounded-full bg-[linear-gradient(160deg,rgb(221_154_95/0.37)_0%,rgb(210_138_76/0)_100%)]"
      />
      <div className="relative flex h-full flex-col pl-4 pt-1 pr-[160px]">
        <p className="text-xs leading-5 text-fg">Bem-vindo à Kurio</p>
        <h1
          id="hero-title"
          className="mt-0.5 text-lg font-bold uppercase leading-[29px] text-fg"
        >
          Seja dono da cultura digital
        </h1>
        <p className="mt-1.5 text-xs leading-[18px] text-fg-muted">
          Descubra NFTs selecionados de criadores do mundo todo.
        </p>
        <button
          type="button"
          onClick={scrollToCatalog}
          className="flex items-center gap-2.5 self-start text-xs font-bold uppercase leading-5 text-accent-text"
        >
          Explorar
          <ArrowRight className="size-4 text-brand" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <img
        {...heroSrc(current.art)}
        sizes="138px"
        alt={current.alt}
        width={138}
        height={138}
        fetchPriority="high"
        className="absolute right-4 top-2.5 size-[138px] rounded-2xl object-cover"
      />
      <img
        {...heroSrc(next.art)}
        sizes="58px"
        alt=""
        width={58}
        height={58}
        className="absolute right-[82px] top-[98.5px] size-[58px] rounded-2xl object-cover"
      />
      <HeroDots
        slide={slide}
        onSelect={setSlide}
        className="absolute inset-x-0 bottom-0 flex h-5 justify-center -space-x-1.5"
      />
    </section>
  );
}

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
    <section aria-labelledby="hero-title" className="relative">
      <div className="grid items-start gap-8 lg:min-h-112.5 lg:grid-cols-[minmax(0,1fr)_450px]">
        <div className="flex flex-col lg:pl-10 lg:pt-10">
          <p className="text-[15px] leading-5.5 tracking-[0.05em] text-fg-strong">
            Bem-vindo à Kurio
          </p>
          <h1
            id="hero-title"
            className="mt-1.5 max-w-130 text-display font-bold uppercase leading-17.5 text-fg-strong"
          >
            Seja dono do futuro da arte digital
          </h1>
          <p className="mt-[3px] max-w-140 text-sm leading-6 text-fg-muted">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <Button
            className="mt-8 h-10 w-35 self-start px-0 text-base font-bold"
            onClick={scrollToCatalog}
          >
            Explorar
          </Button>
        </div>
        <div className="relative mx-auto w-full max-w-112.5 lg:mx-0 lg:justify-self-end">
          <img
            {...heroSrc(HERO_SLIDES[slide].art)}
            sizes="450px"
            alt={HERO_SLIDES[slide].alt}
            width={450}
            height={450}
            fetchPriority="high"
            className="aspect-square w-full rounded-[20px] object-cover"
          />
        </div>
      </div>
      <HeroDots
        slide={slide}
        onSelect={setSlide}
        className="mt-6 flex justify-center gap-0.5 lg:absolute lg:left-146 lg:top-[392px] lg:mt-0 lg:justify-start"
      />
    </section>
  );
}

function FeaturedBanner() {
  const featured = useQuery(featuredQuery());
  const item = featured.data?.items[0];
  return (
    <aside aria-labelledby="featured-title" className="bg-featured pt-6.5">
      <p
        id="featured-title"
        className="px-5 text-2xl font-bold uppercase leading-7 text-accent-text"
      >
        NFT em destaque
      </p>
      <p className="mt-3.5 text-center text-[22px] font-bold uppercase leading-7 text-fg-strong">
        Oferta limitada
      </p>
      <div className="mt-2">
        {item ? (
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.id }}
            className="group block"
          >
            <img
              src="/figma/featured.webp"
              alt={`Arte do NFT ${item.name}`}
              width={310}
              height={341}
              loading="lazy"
              className="aspect-310/341 w-full rounded-[20px] object-cover"
            />
            <span className="sr-only">
              {item.name}, {formatEth(item.price)}
            </span>
          </Link>
        ) : (
          <Skeleton
            className="aspect-310/341 w-full rounded-[20px]"
            aria-hidden
          />
        )}
      </div>
    </aside>
  );
}

function SearchBox({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (q: string) => void;
  className?: string;
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
      className={cn("relative", className)}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs por nome, criador ou token
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-5.5 -translate-y-1/2 text-brand-secondary"
        strokeWidth={1.75}
        aria-hidden
      />
      <Input
        id="catalog-search"
        type="search"
        placeholder="Explorar coleções"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-[45px] rounded-[10px] border-transparent bg-surface pl-12 text-sm placeholder:text-brand-secondary"
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
  const base =
    "flex size-8.5 items-center justify-center rounded-md border text-base transition-colors";
  return (
    <nav
      aria-label="Paginação do catálogo"
      className="mt-12 flex flex-wrap items-center justify-center gap-2 lg:mt-16 lg:justify-end"
    >
      {page > 1 && (
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
          className={cn(
            base,
            "border-line-soft text-fg hover:border-accent-text",
          )}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      )}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          aria-label={`Página ${p}`}
          onClick={() => onPage(p)}
          className={cn(
            base,
            p === page
              ? "border-primary bg-primary font-bold text-primary-foreground"
              : "border-line-soft text-fg hover:border-accent-text",
          )}
        >
          {p}
        </button>
      ))}
      {page < totalPages && (
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          aria-label="Próxima página"
          className={cn(
            base,
            "border-line-soft text-fg hover:border-accent-text",
          )}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </nav>
  );
}

const PROMOS = [
  {
    image: "/figma/banner-1.webp",
    alt: "Macaco de óculos redondos e jaqueta verde",
    title: "Lançamentos gênesis\nde edição limitada",
    text: "Colecione edições escassas diretamente dos criadores antes da revelação pública.",
  },
  {
    image: "/figma/banner-2.webp",
    alt: "Chimpanzé de blazer bege e gola alta verde",
    title: "Arte digital selecionada\ne muito mais",
    text: "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.",
  },
];

function PromoBanners() {
  return (
    <section
      aria-label="Destaques da Kurio"
      className="grid gap-7 lg:mt-2 lg:grid-cols-2"
    >
      {PROMOS.map((promo) => (
        <article
          key={promo.title}
          className="flex overflow-hidden rounded-[10px] bg-surface lg:h-62.5"
        >
          <img
            src={promo.image}
            alt={promo.alt}
            width={287}
            height={250}
            loading="lazy"
            className="hidden w-35 shrink-0 object-cover object-left sm:block sm:w-60 xl:w-67.5"
          />
          <div className="flex flex-1 flex-col items-end py-8 pl-2 pr-6 text-right xl:pr-7.5 xl:pt-9.5">
            <h2 className="text-xl font-bold leading-6 text-fg-strong xl:whitespace-pre-line">
              {promo.title}
            </h2>
            <p className="mt-1.5 max-w-70 text-sm leading-6 text-fg-muted">
              {promo.text}
            </p>
            <Button
              className="mt-3 h-10 w-35 shrink-0 text-sm font-medium normal-case tracking-normal"
              onClick={scrollToCatalog}
            >
              Explorar <ArrowRight aria-hidden />
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

const POSTS = [
  {
    image: "/figma/diary-1.webp",
    date: "12 de setembro",
    read: "Leitura de 6 min",
    title: "Como funciona a propriedade de NFTs",
    text: "Aprenda a colecionar, negociar e verificar ativos digitais.",
  },
  {
    image: "/figma/diary-2.webp",
    date: "13 de setembro",
    read: "Leitura de 2 min",
    title: "10 artistas digitais para acompanhar",
    text: "Conheça criadores que moldam a cultura digital.",
  },
  {
    image: "/figma/diary-3.webp",
    date: "15 de setembro",
    read: "Leitura de 3 min",
    title: "Raridade, atributos e procedência",
    text: "Entenda raridade, procedência, direitos autorais e utilidade.",
  },
  {
    image: "/figma/diary-4.webp",
    date: "15 de setembro",
    read: "Leitura de 2 min",
    title: "Como proteger sua carteira",
    text: "Proteja sua carteira, seus ativos e sua identidade.",
  },
];

function Journal() {
  return (
    <section aria-labelledby="journal-title">
      <div className="text-center">
        <h2
          id="journal-title"
          className="text-[28px] font-bold leading-9 text-fg-strong"
        >
          Diário da Cunhagem
        </h2>
        <p className="mt-2.5 text-sm leading-6 text-fg-muted">
          Histórias, guias e insights para colecionadores sobre o universo da
          propriedade digital.
        </p>
      </div>
      <ul className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="group flex h-full flex-col overflow-hidden rounded-[10px] bg-surface">
              <img
                src={post.image}
                alt=""
                width={268}
                height={195}
                loading="lazy"
                className="aspect-268/195 w-full object-cover"
              />
              <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                <p className="text-xs leading-5 text-fg-muted">
                  {post.date}
                  <span aria-hidden className="mx-2">
                    |
                  </span>
                  {post.read}
                </p>
                <h3 className="mt-2 text-[17px] font-bold leading-5.5 text-fg-strong">
                  {post.title}
                </h3>
                <p className="mt-2 text-[13px] leading-5 text-accent-text/90">
                  {post.text}
                </p>
                <span className="mt-1.5 text-[13px] font-bold text-accent-text">
                  Ler mais →
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
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

  const setSort = (sort: string) =>
    setSearch({
      sort: sort === "recent" ? undefined : (sort as SortOption),
    });

  const gridClass = isDesktop
    ? "grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-3 lg:gap-x-8.5 lg:gap-y-16"
    : // Mobile (Figma): grade em “alvenaria”, 2ª coluna deslocada 32 px
      "grid grid-cols-2 gap-x-4 gap-y-6 pb-8 [&>li:nth-child(even)]:translate-y-8";

  return (
    <div className="container-kurio flex flex-col gap-4 pt-10 md:gap-24 md:pt-6 lg:pt-8.25">
      {/* Mobile: busca + botão de filtros acima do hero, como no frame mobile */}
      {!isDesktop && (
        <div className="flex gap-2">
          <SearchBox
            className="flex-1"
            value={query.q ?? ""}
            onChange={(q) => setSearch({ q: q || undefined }, true)}
          />
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={`Filtros${filterCount ? `, ${filterCount} ativos` : ""}`}
                className="relative flex size-[45px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(133deg,rgb(210_138_76/0.45)_0%,var(--color-brand)_100%)] text-ink transition hover:brightness-110"
              >
                <Icon name="mobile-filter" className="size-5.5" />
                {filterCount > 0 && (
                  <Badge className="absolute -right-1.5 -top-1.5 min-w-5 justify-center px-1">
                    {filterCount}
                  </Badge>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetTitle className="text-lg font-bold">Filtros</SheetTitle>
              <SheetDescription className="sr-only">
                Filtre e ordene o catálogo por coleção, preço e rede.
              </SheetDescription>
              <Field label="Ordenar por">
                {(props) => (
                  <NativeSelect
                    {...props}
                    value={query.sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    {(Object.keys(SORT_LABEL) as SortOption[]).map((s) => (
                      <option key={s} value={s}>
                        {SORT_LABEL[s]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
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

      {isDesktop ? <Hero /> : <MobileHero />}

      <section
        id="catalogo"
        aria-labelledby="catalog-title"
        className="scroll-mt-6 max-md:-mt-[7px]"
      >
        <h2 id="catalog-title" className="sr-only">
          Catálogo
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
          {isDesktop && (
            <div className="flex flex-col gap-6">
              <h2 className="sr-only">Filtros</h2>
              <div className="bg-surface px-5 pb-5 pt-4">
                <Filters
                  value={filterState}
                  facets={data?.facets}
                  onChange={applyFilters}
                  idPrefix="df"
                  variant="figma"
                />
              </div>
              <FeaturedBanner />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
              {/* Botões de alternância (não há painéis distintos: as seções filtram a mesma lista) */}
              <div
                role="group"
                aria-label="Seções do catálogo"
                className="flex max-w-full items-center gap-5 overflow-x-auto max-md:gap-0"
              >
                {(Object.keys(TAB_LABEL) as CatalogTab[]).map((tab, i) => {
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
                        "relative h-10 whitespace-nowrap text-[15px] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full hover:text-accent-text",
                        // Mobile (Figma): 14 px, espaçamentos 5 px e 16 px entre as abas
                        "max-md:h-[27px] max-md:text-sm max-md:after:rounded-none",
                        i === 1 && "max-md:ml-[5px]",
                        i === 2 && "max-md:ml-4",
                        active
                          ? "text-accent-text after:bg-accent-text max-md:after:bg-brand"
                          : "text-fg after:bg-transparent",
                      )}
                    >
                      {TAB_LABEL[tab]}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center max-md:hidden">
                <span className="text-[15px] text-fg" id="sort-label">
                  Ordenar por:
                </span>
                <Select value={query.sort} onValueChange={setSort}>
                  <SelectTrigger
                    className="h-10 w-auto gap-0.5 border-none bg-transparent px-0 text-[15px] font-normal text-fg"
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

            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                activeChips.length > 0 ? "mt-2 min-h-8" : "h-0",
              )}
            >
              <p
                role="status"
                aria-live="polite"
                className="sr-only"
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

            <div className="mt-2.5 max-md:mt-4">
              {catalog.isPending ? (
                <ul
                  className={gridClass}
                  aria-busy="true"
                  aria-label="Carregando catálogo"
                >
                  {Array.from({ length: CATALOG_PAGE_SIZE }).map((_, i) => (
                    <li key={i}>
                      <NftCardSkeleton
                        variant={isDesktop ? "default" : "mobile"}
                      />
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
                      gridClass,
                      "transition-opacity",
                      isUpdating && "opacity-60",
                    )}
                    aria-busy={isUpdating}
                  >
                    {data?.items.map((nft, i) => (
                      <li key={nft.id}>
                        <NftCard
                          nft={nft}
                          priority={i < 3}
                          variant={isDesktop ? "default" : "mobile"}
                        />
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

      <PromoBanners />
      <Journal />
    </div>
  );
}
