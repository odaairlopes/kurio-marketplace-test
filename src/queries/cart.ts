import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AddCartItemRequest, Cart, Network } from "@/api/contracts";
import { api } from "@/api/endpoints";
import { cartOwnerKey, useSession } from "@/lib/session";
import { keys } from "./keys";

export function useCartOwner() {
  const session = useSession();
  return cartOwnerKey(session);
}

export function useCart() {
  const owner = useCartOwner();
  return useQuery({
    queryKey: keys.cart(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  });
}

/** Cotação calculada pela API — fonte dos valores do resumo e do checkout. */
export function useQuote(network: Network, enabled = true) {
  const owner = useCartOwner();
  const cart = useCart();
  return useQuery({
    // A versão do carrinho entra no escopo da invalidação via setQueryData do carrinho.
    queryKey: keys.quote(owner, network),
    queryFn: ({ signal }) => api.cart.quote(network, { signal }),
    enabled: enabled && !!cart.data,
    staleTime: 0,
  });
}

function useCartMutation<TVars>(
  fn: (vars: TVars) => Promise<Cart>,
  options: { success?: (vars: TVars) => string } = {},
) {
  const owner = useCartOwner();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      queryClient.setQueryData(keys.cart(owner), cart);
      void queryClient.invalidateQueries({
        queryKey: [...keys.cart(owner), "quote"],
      });
      const message = options.success?.(vars);
      if (message) toast.success(message);
    },
    onError: (error) => {
      // Conflito de disponibilidade: o carrinho no servidor é a verdade.
      void queryClient.invalidateQueries({ queryKey: keys.cart(owner) });
      void queryClient.invalidateQueries({ queryKey: keys.nfts });
      return error;
    },
  });
}

export function useAddToCart() {
  return useCartMutation(
    (body: AddCartItemRequest & { name: string }) =>
      api.cart.addItem({
        nftId: body.nftId,
        editionId: body.editionId,
        quantity: body.quantity,
      }),
    { success: (v) => `${v.quantity}× "${v.name}" adicionado ao carrinho.` },
  );
}

export function useUpdateCartItem() {
  return useCartMutation(
    ({
      itemId,
      ...body
    }: {
      itemId: string;
      quantity?: number;
      acceptPrice?: boolean;
    }) => api.cart.updateItem(itemId, body),
  );
}

export function useRemoveCartItem() {
  return useCartMutation(
    ({ itemId }: { itemId: string; name: string }) =>
      api.cart.removeItem(itemId),
    {
      success: (v) => `"${v.name}" removido do carrinho.`,
    },
  );
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api.cart.applyCoupon(code), {
    success: (code) => `Cupom ${code.toUpperCase()} aplicado.`,
  });
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.cart.removeCoupon(), {
    success: () => "Cupom removido.",
  });
}
