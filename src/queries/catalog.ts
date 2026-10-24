import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { CatalogQuery, FavoritesResponse } from "@/api/contracts";
import { api } from "@/api/endpoints";
import { useSession } from "@/lib/session";
import { keys } from "./keys";

export const CATALOG_PAGE_SIZE = 9;

export const catalogQuery = (query: CatalogQuery) =>
  queryOptions({
    queryKey: keys.catalog(query),
    // O `signal` cancela a requisição anterior quando os parâmetros mudam;
    // como cada combinação tem sua própria chave, respostas fora de ordem
    // nunca sobrescrevem o resultado da consulta atual.
    queryFn: ({ signal }) => api.nfts.list(query, { signal }),
    placeholderData: keepPreviousData,
  });

export const featuredQuery = () =>
  queryOptions({
    queryKey: keys.featured,
    queryFn: ({ signal }) => api.nfts.featured({ signal }),
    staleTime: 60_000,
  });

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: keys.nft(id),
    queryFn: ({ signal }) => api.nfts.detail(id, { signal }),
  });

export function useFavorites() {
  const session = useSession();
  return useQuery({
    queryKey: keys.favorites(session?.user.id ?? "anon"),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!session,
  });
}

/** Favoritar com atualização otimista e rollback em caso de falha. */
export function useToggleFavorite() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "anon";
  const key = keys.favorites(userId);

  return useMutation({
    mutationKey: ["favorites", "toggle"],
    mutationFn: ({
      nftId,
      favorite,
    }: {
      nftId: string;
      favorite: boolean;
      name: string;
    }) => (favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoritesResponse>(key);
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? []);
        if (favorite) ids.add(nftId);
        else ids.delete(nftId);
        return { nftIds: [...ids] };
      });
      return { previous };
    },
    onError: (error, { favorite, name }, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(
        `Não foi possível ${favorite ? "favoritar" : "remover dos favoritos"} "${name}". ${error.message}`,
      );
    },
    onSuccess: (data, { favorite, name }) => {
      queryClient.setQueryData(key, data);
      toast.success(
        favorite
          ? `"${name}" adicionado aos favoritos.`
          : `"${name}" removido dos favoritos.`,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
