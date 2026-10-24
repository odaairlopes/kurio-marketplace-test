import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShoppingBag, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { NftDetail } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { FavoriteButton } from "@/components/catalog/NftCard";
import { QuantityStepper } from "@/components/QuantityStepper";
import { ErrorState, NotFound } from "@/components/states";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/controls";
import { Alert, Badge, Skeleton } from "@/components/ui/misc";
import { formatEth } from "@/lib/money";
import { cn, COLLECTION_LABEL, NETWORK_LABEL, shortAddress } from "@/lib/utils";
import { useAddToCart, useCart } from "@/queries/cart";
import { nftQuery } from "@/queries/catalog";
import { useRealtime } from "@/realtime/RealtimeProvider";

const route = getRouteApi("/nft/$nftId");

function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      <div
        className="flex gap-3 lg:flex-col"
        role="group"
        aria-label="Miniaturas da galeria"
      >
        {nft.images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
            className={cn(
              "overflow-hidden rounded-lg border-2 transition-colors",
              active === i
                ? "border-accent-text"
                : "border-transparent opacity-70 hover:opacity-100",
            )}
          >
            <img
              src={src.replace(".webp", "-sm.webp")}
              alt=""
              width={96}
              height={96}
              className="size-16 object-cover sm:size-20 lg:size-24"
            />
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-line">
        <img
          src={nft.images[active]}
          alt={`${nft.name} — imagem ${active + 1} de ${nft.images.length}`}
          width={640}
          height={640}
          fetchPriority="high"
          className="aspect-square w-full object-cover"
        />
      </div>
    </div>
  );
}

function Rating({ average, count }: { average: number; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < Math.round(average)
                ? "fill-accent-text text-accent-text"
                : "text-line-soft",
            )}
          />
        ))}
      </span>
      <span className="sr-only">
        Nota {average.toFixed(1).replace(".", ",")} de 5.
      </span>
      <span className="text-fg-muted">
        {count} avaliações de colecionadores
      </span>
    </div>
  );
}

function PurchasePanel({ nft }: { nft: NftDetail }) {
  const cart = useCart();
  const addToCart = useAddToCart();
  const firstAvailable =
    nft.editions.find((e) => e.available > 0) ?? nft.editions[0];
  const [editionId, setEditionId] = useState(firstAvailable.id);
  const [quantity, setQuantity] = useState(1);
  const edition =
    nft.editions.find((e) => e.id === editionId) ?? firstAvailable;
  const inCart =
    cart.data?.items.find(
      (i) => i.nftId === nft.id && i.editionId === edition.id,
    )?.quantity ?? 0;
  const limit = Math.max(
    0,
    Math.min(edition.available, edition.maxPerOrder) - inCart,
  );
  const unavailable = edition.available === 0;

  useEffect(() => {
    if (quantity > Math.max(1, limit)) setQuantity(Math.max(1, limit));
  }, [limit, quantity]);

  const conflict = addToCart.error instanceof ApiError ? addToCart.error : null;

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 font-bold">Edição</legend>
        <RadioGroup
          value={edition.id}
          onValueChange={(v) => {
            setEditionId(v);
            setQuantity(1);
            addToCart.reset();
          }}
          className="grid-cols-[minmax(0,1fr)] gap-2"
        >
          {nft.editions.map((e) => (
            <label
              key={e.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                e.id === edition.id
                  ? "border-accent-text bg-surface"
                  : "border-line hover:border-line-soft",
                e.available === 0 && "cursor-not-allowed opacity-60",
              )}
            >
              <RadioGroupItem
                value={e.id}
                disabled={e.available === 0}
                aria-describedby={`ed-${e.id}`}
              />
              <span className="flex-1">
                <span className="block font-bold">{e.label}</span>
                <span id={`ed-${e.id}`} className="block text-xs text-fg-muted">
                  {e.available === 0
                    ? "Esgotada"
                    : `${e.available} de ${e.supply} disponíveis · máx. ${e.maxPerOrder} por pedido`}
                </span>
              </span>
              <span className="font-bold text-accent-text">
                {formatEth(e.price)}
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>

      {unavailable ? (
        <Alert variant="warning" title="Edição indisponível">
          Esta edição está esgotada. Escolha outra edição disponível.
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <QuantityStepper
              value={quantity}
              max={Math.max(1, limit)}
              onChange={setQuantity}
              label="Quantidade"
              disabled={limit === 0}
            />
            <p className="text-sm text-fg-muted" id="qty-hint">
              {limit === 0
                ? "Você já tem o máximo permitido desta edição no carrinho."
                : `Até ${limit} ${limit === 1 ? "unidade" : "unidades"}${inCart ? ` (já há ${inCart} no carrinho)` : ""}`}
            </p>
          </div>
          <Button
            size="lg"
            disabled={limit === 0}
            loading={addToCart.isPending}
            aria-describedby="qty-hint"
            onClick={() =>
              addToCart.mutate({
                nftId: nft.id,
                editionId: edition.id,
                quantity,
                name: nft.name,
              })
            }
            data-testid="add-to-cart"
          >
            <ShoppingBag aria-hidden /> Adicionar ao carrinho ·{" "}
            {formatEth(edition.price)}
          </Button>
          {conflict && (
            <p role="alert" className="text-sm text-danger">
              {conflict.message}
            </p>
          )}
          {addToCart.isSuccess && (
            <p role="status" className="text-sm text-success">
              Adicionado!{" "}
              <Link to="/cart" className="underline">
                Ir para o carrinho
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NftSkeleton() {
  return (
    <div
      className="grid gap-10 lg:grid-cols-[1fr_480px]"
      aria-busy="true"
      aria-label="Carregando NFT"
    >
      <div className="flex flex-col-reverse gap-4 lg:flex-row">
        <div className="flex gap-3 lg:flex-col">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-16 sm:size-20 lg:size-24" />
          ))}
        </div>
        <Skeleton className="aspect-square flex-1 rounded-xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function NftPage() {
  const { nftId } = route.useParams();
  const nft = useQuery(nftQuery(nftId));
  const { lastNftChange } = useRealtime();
  const change = lastNftChange[nftId];

  useEffect(() => {
    if (nft.data) document.title = `${nft.data.name} — KURIO`;
    return () => {
      document.title = "KURIO — Marketplace de NFTs";
    };
  }, [nft.data]);

  if (nft.error instanceof ApiError && nft.error.status === 404) {
    return (
      <NotFound
        title="NFT não encontrado"
        description="Este NFT não existe, foi removido ou o endereço está incorreto."
      />
    );
  }

  return (
    <div className="container-kurio flex flex-col gap-8 pt-8">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Mercado", to: "/" },
          { label: nft.data?.name ?? "NFT" },
        ]}
      />
      {nft.isPending ? (
        <NftSkeleton />
      ) : nft.isError ? (
        <ErrorState error={nft.error} onRetry={() => void nft.refetch()} />
      ) : (
        <article className="grid gap-10 lg:grid-cols-[1fr_480px]">
          <Gallery key={nft.data.id} nft={nft.data} />
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {COLLECTION_LABEL[nft.data.collection]}
                  </Badge>
                  <Badge variant="outline">
                    {NETWORK_LABEL[nft.data.network]}
                  </Badge>
                  {nft.data.soldOut && <Badge variant="danger">Esgotado</Badge>}
                </div>
                <h1 className="text-[28px] font-bold leading-tight md:text-4xl">
                  {nft.data.name}
                </h1>
                <p className="text-sm text-fg-muted">
                  por <span className="text-fg">{nft.data.creator}</span>
                </p>
              </div>
              <FavoriteButton
                nftId={nft.data.id}
                name={nft.data.name}
                size="lg"
              />
            </div>
            <div className="flex items-baseline gap-3">
              <p
                className="text-3xl font-bold text-accent-text"
                data-testid="nft-price"
              >
                {formatEth(nft.data.price)}
              </p>
              {nft.data.previousPrice && (
                <p className="text-fg-muted line-through">
                  <span className="sr-only">Preço anterior: </span>
                  {formatEth(nft.data.previousPrice)}
                </p>
              )}
            </div>
            <Rating
              average={nft.data.rating.average}
              count={nft.data.rating.count}
            />
            <div role="status" aria-live="polite">
              {change && (
                <Alert
                  variant="warning"
                  title="Atualização em tempo real"
                  data-testid="nft-realtime-notice"
                >
                  {change.message}
                </Alert>
              )}
            </div>
            <PurchasePanel key={nft.data.id} nft={nft.data} />
            <section
              aria-labelledby="desc-title"
              className="flex flex-col gap-3 border-t border-line pt-6"
            >
              <h2 id="desc-title" className="font-bold">
                Descrição
              </h2>
              <p className="text-sm leading-6 text-fg-muted">
                {nft.data.description}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-fg-muted">ID do token</dt>
                <dd className="text-right">{nft.data.tokenId}</dd>
                <dt className="text-fg-muted">Contrato</dt>
                <dd className="text-right" title={nft.data.contractAddress}>
                  {shortAddress(nft.data.contractAddress)}
                </dd>
                <dt className="text-fg-muted">Royalties</dt>
                <dd className="text-right">{nft.data.royaltiesPercent}%</dd>
                <dt className="text-fg-muted">Rede</dt>
                <dd className="text-right">
                  {NETWORK_LABEL[nft.data.network]}
                </dd>
              </dl>
            </section>
          </div>
        </article>
      )}
    </div>
  );
}
