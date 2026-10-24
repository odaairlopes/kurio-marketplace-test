import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Session, WalletInput } from "@/api/contracts";
import { api } from "@/api/endpoints";
import {
  getGuestCartId,
  rotateGuestCartId,
  sessionStore,
  useSession,
} from "@/lib/session";
import { keys } from "./keys";

/** Remove do cache tudo o que é privado (dados do usuário e carrinhos). */
export function clearPrivateCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: ["user"] });
  queryClient.removeQueries({ queryKey: ["cart"] });
}

/**
 * Após autenticar: mescla o carrinho do visitante no carrinho do usuário
 * e troca o identificador do visitante.
 */
export async function establishSession(
  queryClient: QueryClient,
  session: Session,
) {
  const previous = sessionStore.userId();
  if (previous && previous !== session.user.id) clearPrivateCache(queryClient);
  const guestCartId = getGuestCartId();
  sessionStore.set(session);
  try {
    const cart = await api.cart.merge(guestCartId);
    queryClient.setQueryData(keys.cart(`user:${session.user.id}`), cart);
  } finally {
    queryClient.removeQueries({ queryKey: keys.cart(`guest:${guestCartId}`) });
    rotateGuestCartId();
  }
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: (session) => establishSession(queryClient, session),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.register,
    onSuccess: (session) => establishSession(queryClient, session),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        // Mesmo offline, a sessão local é encerrada.
      }
    },
    onSettled: () => {
      sessionStore.clear();
      clearPrivateCache(queryClient);
    },
  });
}

export function useProfile() {
  const session = useSession();
  return useQuery({
    queryKey: keys.profile(session?.user.id ?? "anon"),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: !!session,
  });
}

export function useUpdateProfile() {
  const session = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.profile.update,
    onSuccess: (user) => {
      queryClient.setQueryData(keys.profile(user.id), user);
      if (session) sessionStore.updateUser(user);
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name }: { file: Blob; name: string }) =>
      api.profile.uploadAvatar(file, name),
    onSuccess: (user) => {
      queryClient.setQueryData(keys.profile(user.id), user);
      sessionStore.updateUser(user);
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.profile.removeAvatar,
    onSuccess: (user) => {
      queryClient.setQueryData(keys.profile(user.id), user);
      sessionStore.updateUser(user);
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: api.profile.changePassword });
}

export function useWallets(enabled = true) {
  const session = useSession();
  return useQuery({
    queryKey: keys.wallets(session?.user.id ?? "anon"),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
    enabled: !!session && enabled,
  });
}

export function useSaveWallet() {
  const session = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WalletInput }) =>
      id ? api.wallets.update(id, input) : api.wallets.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: keys.wallets(session?.user.id ?? "anon"),
      }),
  });
}

export function useOrders() {
  const session = useSession();
  return useQuery({
    queryKey: keys.orders(session?.user.id ?? "anon"),
    queryFn: ({ signal }) => api.orders.list({ signal }),
    enabled: !!session,
  });
}
