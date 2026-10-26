import { useEffect, useState } from "react";
import type { NftDetail } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { useAddToCart, useCart } from "@/queries/cart";

/**
 * Estado de compra do detalhe (edição, quantidade e limite considerando o que
 * já está no carrinho). Compartilhado pelos layouts desktop e mobile.
 */
export function usePurchase(nft: NftDetail) {
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

  useEffect(() => {
    if (quantity > Math.max(1, limit)) setQuantity(Math.max(1, limit));
  }, [limit, quantity]);

  const selectEdition = (id: string) => {
    setEditionId(id);
    setQuantity(1);
    addToCart.reset();
  };

  const add = (onSuccess?: () => void) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity, name: nft.name },
      { onSuccess },
    );

  return {
    edition,
    selectEdition,
    quantity,
    setQuantity,
    inCart,
    limit,
    unavailable: edition.available === 0,
    add,
    adding: addToCart.isPending,
    added: addToCart.isSuccess,
    conflict: addToCart.error instanceof ApiError ? addToCart.error : null,
  };
}

export type Purchase = ReturnType<typeof usePurchase>;

export function quantityHint({ limit, inCart }: Purchase) {
  return limit === 0
    ? "Você já tem o máximo permitido desta edição no carrinho."
    : `Até ${limit} ${limit === 1 ? "unidade" : "unidades"}${inCart ? ` (já há ${inCart} no carrinho)` : ""}`;
}
