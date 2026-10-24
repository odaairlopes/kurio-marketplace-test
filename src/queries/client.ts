import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/http";

/**
 * Política de cache, retries e sincronização (documentada no ARCHITECTURE.md):
 * - Queries: retry até 2x apenas para falhas transitórias (rede, timeout, 5xx),
 *   backoff exponencial; 4xx nunca é repetido.
 * - Mutations: sem retry automático — repetir uma escrita pode duplicar a
 *   operação. O pedido usa chave de idempotência para retentativas explícitas.
 * - staleTime padrão de 30s; eventos Socket.IO mantêm catálogo/detalhe/carrinho
 *   atualizados e a reconexão força a reconciliação via REST.
 */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "CANCELED") return false;
    return error.isTransient && failureCount < 2;
  }
  return failureCount < 1;
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
