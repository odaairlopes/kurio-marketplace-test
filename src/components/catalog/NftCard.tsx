import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { NftSummary } from "@/api/contracts";
import { Badge, Skeleton } from "@/components/ui/misc";
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
  size?: "sm" | "lg";
}) {
  const session = useSession();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const navigate = useNavigate();
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
          void navigate({ to: "/login", search: { redirect: href } });
          return;
        }
        toggle.mutate({ nftId, favorite: !active, name });
      }}
      className={cn(
        "flex items-center justify-center rounded-full border border-line-soft bg-ink/80 backdrop-blur transition-colors hover:border-accent-text hover:text-accent-text",
        size === "sm" ? "size-9" : "size-11",
        active ? "text-accent-text" : "text-fg",
        className,
      )}
    >
      <Heart
        className={size === "sm" ? "size-4" : "size-5"}
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

export function NftCard({
  nft,
  priority = false,
}: {
  nft: NftSummary;
  priority?: boolean;
}) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-soft"
      data-testid="nft-card"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={nft.imageSmall}
          srcSet={`${nft.imageSmall} 320w, ${nft.image} 640w`}
          sizes="(min-width: 1280px) 258px, (min-width: 768px) 30vw, 46vw"
          alt={`Arte do NFT ${nft.name}`}
          width={320}
          height={320}
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
        {!nft.soldOut && nft.isNew && (
          <Badge className="absolute left-3 top-3">Novo</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <h3 className="line-clamp-2 text-sm font-bold md:truncate md:text-[15px]">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 focus-visible:outline-none"
            data-testid="nft-card-link"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="text-xs text-fg-muted">
          {nft.creator} · {NETWORK_LABEL[nft.network]}
        </p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span
            className="text-[15px] font-bold text-accent-text"
            data-testid="nft-card-price"
          >
            {formatEth(nft.price)}
          </span>
          {nft.previousPrice && (
            <span className="text-xs text-fg-muted line-through">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.previousPrice)}
            </span>
          )}
        </div>
      </div>
      {/* Fica acima do link expandido da card */}
      <FavoriteButton
        nftId={nft.id}
        name={nft.name}
        className="absolute right-3 top-3 z-10"
      />
    </article>
  );
}

export function NftCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
      aria-hidden
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4.5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mt-2 h-4.5 w-1/3" />
      </div>
    </div>
  );
}
