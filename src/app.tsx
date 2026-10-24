/**
 * Aplicação. Renderiza em paralelo à inicialização do MSW; requisições e o
 * socket aguardam `mocksReady`.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { api } from "@/api/endpoints";
import { sessionStore } from "@/lib/session";
import { createQueryClient } from "@/queries/client";
import { RealtimeProvider } from "@/realtime/RealtimeProvider";
import { createAppRouter } from "@/router";

/** Recupera a sessão após refresh: o token salvo é revalidado na API. */
async function restoreSession() {
  if (!sessionStore.get()) return;
  try {
    const session = await api.auth.session();
    sessionStore.updateUser(session.user);
  } catch {
    // 401 → o interceptor encerra a sessão; falha de rede mantém a sessão local.
  }
}

export async function mountApp() {
  // Não bloqueia a renderização: rotas privadas revalidam a sessão no beforeLoad.
  void restoreSession().then(() => sessionStore.clearExpiredFlag());

  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
