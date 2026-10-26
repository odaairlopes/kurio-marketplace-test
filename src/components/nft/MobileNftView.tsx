import { Link, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useState } from "react";
import type { NftDetail } from "@/api/contracts";
import { FavoriteButton } from "@/components/catalog/NftCard";
import { BackButton, CIRCLE_BUTTON } from "@/components/mobile/MobileTopBar";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Alert } from "@/components/ui/misc";
import { formatEth } from "@/lib/money";
import { cn, COLLECTION_LABEL, NETWORK_LABEL } from "@/lib/utils";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { quantityHint, usePurchase } from "./usePurchase";

function MobileGallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0);
  return (
    <div className="relative mt-[9px] overflow-hidden rounded-3xl">
      <img
        src={nft.images[active]}
        alt={`${nft.name} — imagem ${active + 1} de ${nft.images.length}`}
        width={361}
        height={356}
        fetchPriority="high"
        className="aspect-[361/356] w-full object-cover"
      />
      <div
        role="group"
        aria-label="Miniaturas da galeria"
        className="absolute inset-x-0 bottom-[42px] flex items-center justify-center"
      >
        {nft.images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
            className="flex h-6 items-center px-[3.5px]"
          >
            <span
              className={cn(
                "block h-[7px] rounded-full bg-brand transition-all",
                active === i ? "w-7" : "w-[7px]",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingPill({ average, count }: { average: number; count: number }) {
  return (
    <p className="flex h-[26px] shrink-0 items-center gap-1 rounded-full border border-brand px-2.5 text-sm">
      <Star className="size-3.5 fill-star text-star" aria-hidden />
      <span aria-hidden className="text-fg">
        {average.toFixed(1)}
        <span className="text-fg-muted">({count})</span>
      </span>
      <span className="sr-only">
        Nota {average.toFixed(1).replace(".", ",")} de 5, {count} avaliações de
        colecionadores
      </span>
    </p>
  );
}

/** Detalhe do NFT no layout do frame mobile do Figma. */
export function MobileNftView({
  nft,
  notice,
}: {
  nft: NftDetail;
  notice?: string;
}) {
  const navigate = useNavigate();
  const purchase = usePurchase(nft);
  const { edition, limit, unavailable, conflict } = purchase;

  const buyNow = () => {
    const goToCart = () => void navigate({ to: "/cart" });
    if (limit === 0) goToCart();
    else purchase.add(goToCart);
  };

  return (
    <article>
      <div className="bg-[linear-gradient(132deg,var(--color-surface)_0%,var(--color-surface-raised)_100%)] px-7 pt-[23px]">
        <div className="flex items-center justify-between">
          <BackButton className="text-fg-muted" />
          <FavoriteButton
            nftId={nft.id}
            name={nft.name}
            className={cn(CIRCLE_BUTTON, "text-accent-text backdrop-blur-none")}
          />
        </div>
        <MobileGallery nft={nft} />
      </div>

      <div className="relative -mt-[30px] rounded-t-[31px] bg-surface px-6 pb-[200px] pt-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-7 text-fg">{nft.name}</h1>
          <RatingPill
            average={nft.rating.average}
            count={nft.rating.count}
          />
        </div>
        <p className="mt-[11px] text-sm leading-6 text-fg-muted">
          {nft.description}
        </p>

        <fieldset className="mt-2.5">
          <legend className="text-sm font-bold leading-5 text-fg">
            Edição:
          </legend>
          <RadioGroup
            value={edition.id}
            onValueChange={purchase.selectEdition}
            className="mt-1.5 flex flex-wrap gap-[13px]"
          >
            {nft.editions.map((e) => (
              <RadioGroupPrimitive.Item
                key={e.id}
                value={e.id}
                disabled={e.available === 0}
                aria-label={`${e.label}, ${formatEth(e.price)}${e.available === 0 ? ", esgotada" : ""}`}
                className={cn(
                  "h-7 rounded-full border px-2 text-sm uppercase transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40",
                  e.id === edition.id
                    ? "border-brand font-bold text-accent-text"
                    : "border-line text-fg-muted hover:border-line-soft",
                )}
              >
                {e.label}
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroup>
        </fieldset>

        <dl className="mt-1.5 text-sm leading-8 text-brand-secondary">
          <div>
            <dt className="inline">ID do token: </dt>
            <dd className="inline">{nft.tokenId}</dd>
          </div>
          <div>
            <dt className="inline">Coleção: </dt>
            <dd className="inline">{COLLECTION_LABEL[nft.collection]}</dd>
          </div>
          <div>
            <dt className="inline">Rede: </dt>
            <dd className="inline">{NETWORK_LABEL[nft.network]}</dd>
          </div>
          <div>
            <dt className="inline">Disponíveis: </dt>
            <dd className="inline">
              {edition.available === 0
                ? "esgotada"
                : `${edition.available} de ${edition.supply}`}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-col gap-3">
          <div role="status" aria-live="polite">
            {notice && (
              <Alert
                variant="warning"
                title="Atualização em tempo real"
                data-testid="nft-realtime-notice"
              >
                {notice}
              </Alert>
            )}
          </div>
          {unavailable ? (
            <Alert variant="warning" title="Edição indisponível">
              Esta edição está esgotada. Escolha outra edição disponível.
            </Alert>
          ) : (
            <p className="text-xs text-fg-muted" id="qty-hint">
              {quantityHint(purchase)}
            </p>
          )}
          {conflict && (
            <p role="alert" className="text-sm text-danger">
              {conflict.message}
            </p>
          )}
          {purchase.added && (
            <p role="status" className="text-sm text-success">
              Adicionado!{" "}
              <Link to="/cart" className="underline">
                Ir para o carrinho
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Barra de compra fixa (Figma: 164 px, cantos de 40 px) */}
      <div className="shadow-sheet fixed inset-x-0 bottom-0 z-30 rounded-t-[40px] bg-surface px-6 pb-[calc(34px+env(safe-area-inset-bottom))] pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-medium text-fg-muted" aria-hidden>
              Qtd.
            </span>
            <QuantityStepper
              variant="pill"
              value={purchase.quantity}
              max={Math.max(1, limit)}
              onChange={purchase.setQuantity}
              label="Quantidade"
              disabled={limit === 0 || unavailable}
            />
          </div>
          <p
            className="text-xl font-bold text-accent-text"
            data-testid="nft-price"
          >
            {formatEth(edition.price)}
          </p>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="gradient"
            size="xl"
            className="w-[196px]"
            disabled={unavailable}
            loading={purchase.adding}
            onClick={buyNow}
            aria-describedby="qty-hint"
          >
            Comprar NFT
          </Button>
          <button
            type="button"
            onClick={() => purchase.add()}
            disabled={limit === 0 || unavailable || purchase.adding}
            aria-label={`Adicionar ao carrinho · ${formatEth(edition.price)}`}
            aria-describedby="qty-hint"
            data-testid="add-to-cart"
            className={cn(
              CIRCLE_BUTTON,
              "size-[59px] text-brand-secondary disabled:opacity-50",
            )}
          >
            <Icon name="mobile-shop" className="size-5" />
          </button>
        </div>
      </div>
    </article>
  );
}
