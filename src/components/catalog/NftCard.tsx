import { Link, useRouterState } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { NftSummary } from "@/api/contracts";
import { Badge, Skeleton } from "@/components/ui/misc";
import { authModal } from "@/lib/auth-modal";
import { formatEth } from "@/lib/money";
import { useSession } from "@/lib/session";
import { cn, NETWORK_LABEL } from "@/lib/utils";
import { useFavorites, useToggleFavorite } from "@/queries/catalog";

export function FavoriteButton({
  nftId,
  name,
  className,
  size = "sm",
}: {
  nftId: string;
  name: string;
  className?: string;
  /** xs: 27 px (card mobile) · sm: 36 px · lg: 44 px */
  size?: "xs" | "sm" | "lg";
}) {
  const session = useSession();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const href = useRouterState({ select: (s) => s.location.href });
  const active = favorites.data?.nftIds.includes(nftId) ?? false;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active ? `Remover ${name} dos favoritos` : `Favoritar ${name}`
      }
      data-testid={`favorite-${nftId}`}
      onClick={() => {
        if (!session) {
          authModal.open("login", { redirect: href });
          return;
        }
        toggle.mutate({ nftId, favorite: !active, name });
      }}
      className={cn(
        "flex items-center justify-center rounded-full border border-line-soft bg-ink/80 backdrop-blur transition-colors hover:border-accent-text hover:text-accent-text",
        size === "xs"
          ? "size-[27px] border-line bg-surface-raised text-brand backdrop-blur-none"
          : size === "sm"
            ? "size-9"
            : "size-11",
        size !== "xs" && (active ? "text-accent-text" : "text-fg"),
        className,
      )}
    >
      <Heart
        className={
          size === "xs" ? "size-3.5" : size === "sm" ? "size-4" : "size-5"
        }
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

type CardVariant = "default" | "mobile";

/** Card do frame mobile do Figma: moldura com gradiente, selo “Raro”, favorito sempre visível. */
function MobileNftCard({ nft, priority }: { nft: NftSummary; priority: boolean }) {
  return (
    <article className="group relative" data-testid="nft-card">
      <div className="relative rounded-[20px] bg-card-gradient px-1 py-4">
        <div className="relative aspect-square overflow-hidden rounded-2xl">
          <img
            src={nft.imageSmall}
            srcSet={`${nft.imageSmall} 400w, ${nft.image} 800w`}
            sizes="46vw"
            alt={`Arte do NFT ${nft.name}`}
            width={168}
            height={168}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="size-full object-cover"
          />
          {nft.soldOut && (
            <Badge variant="danger" className="absolute bottom-2 left-2">
              Esgotado
            </Badge>
          )}
        </div>
        {nft.rare && (
          <span className="absolute left-0 top-4 flex h-8 w-17 items-center justify-center bg-brand text-[13px] uppercase text-ink">
            Raro
          </span>
        )}
      </div>
      <h3 className="mt-2 truncate px-2 text-[15px] leading-5 text-fg">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 focus-visible:outline-none"
          data-testid="nft-card-link"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="flex flex-wrap items-baseline gap-x-2 px-2 text-base leading-6">
        <span className="sr-only">
          {nft.creator}, {NETWORK_LABEL[nft.network]}.{" "}
        </span>
        <span className="font-bold text-accent-text" data-testid="nft-card-price">
          {formatEth(nft.price)}
        </span>
        {nft.previousPrice && (
          <span className="text-xs text-fg-muted line-through">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.previousPrice)}
          </span>
        )}
      </p>
      <FavoriteButton
        nftId={nft.id}
        name={nft.name}
        size="xs"
        className="absolute right-[11px] top-4.5 z-10"
      />
    </article>
  );
}

export function NftCard({
  nft,
  priority = false,
  variant = "default",
}: {
  nft: NftSummary;
  priority?: boolean;
  variant?: CardVariant;
}) {
  if (variant === "mobile")
    return <MobileNftCard nft={nft} priority={priority} />;
  return (
    <article className="group relative" data-testid="nft-card">
      <div className="relative bg-surface px-1 pb-[19px] pt-[22px] md:pt-[31px]">
        <div className="relative aspect-square overflow-hidden rounded-2xl">
          <img
            src={nft.imageSmall}
            srcSet={`${nft.imageSmall} 400w, ${nft.image} 800w`}
            sizes="(min-width: 1280px) 250px, (min-width: 768px) 30vw, 46vw"
            alt={`Arte do NFT ${nft.name}`}
            width={250}
            height={250}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {nft.soldOut && (
            <Badge variant="danger" className="absolute left-3 top-3">
              Esgotado
            </Badge>
          )}
        </div>
      </div>
      <h3 className="mt-2 truncate text-base leading-6 text-fg">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 focus-visible:outline-none"
          data-testid="nft-card-link"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="mt-[3px] flex flex-wrap items-baseline gap-x-2 text-lg leading-7">
        <span className="sr-only">
          {nft.creator}, {NETWORK_LABEL[nft.network]}.{" "}
        </span>
        <span
          className="font-bold text-accent-text"
          data-testid="nft-card-price"
        >
          {formatEth(nft.price)}
        </span>
        {nft.previousPrice && (
          <span className="text-fg-muted">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.previousPrice)}
          </span>
        )}
      </p>
      {/* Visível ao passar o mouse, ao focar ou quando favoritado; fica acima do link expandido */}
      <FavoriteButton
        nftId={nft.id}
        name={nft.name}
        className="absolute right-3 top-6 z-10 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-pressed:opacity-100 md:top-9 [@media(hover:none)]:opacity-100"
      />
    </article>
  );
}

export function NftCardSkeleton({
  variant = "default",
}: {
  variant?: CardVariant;
}) {
  if (variant === "mobile")
    return (
      <div aria-hidden>
        <div className="rounded-[20px] bg-card-gradient px-1 py-4">
          <Skeleton className="aspect-square w-full rounded-2xl" />
        </div>
        <Skeleton className="mx-2 mt-2.5 h-4 w-3/4" />
        <Skeleton className="mx-2 mt-2 h-4 w-1/3" />
      </div>
    );
  return (
    <div aria-hidden>
      <div className="bg-surface px-1 pb-[19px] pt-[22px] md:pt-[31px]">
        <Skeleton className="aspect-square w-full rounded-2xl" />
      </div>
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-5 w-1/3" />
    </div>
  );
}
