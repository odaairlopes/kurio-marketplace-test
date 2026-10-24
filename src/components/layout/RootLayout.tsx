import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { api } from "@/api/endpoints";
import { sessionStore, useSession } from "@/lib/session";
import { clearPrivateCache } from "@/queries/account";
import { useRealtime } from "@/realtime/RealtimeProvider";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ScenarioPanel } from "./ScenarioPanel";

const PRIVATE_PREFIXES = ["/checkout", "/orders", "/profile", "/wallets"];

/**
 * Reage a eventos da sessão: expiração (preserva a rota atual para retomada),
 * logout e troca de usuário (limpa caches privados).
 */
function SessionWatcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();

  useEffect(
    () =>
      sessionStore.onEvent((event) => {
        if (event.type === "expired" || event.type === "logout") {
          clearPrivateCache(queryClient);
        }
        const location = router.state.location;
        if (event.type === "expired") {
          toast.warning(
            "Sua sessão expirou. Entre novamente para continuar de onde parou.",
            { id: "session-expired" },
          );
          void router.navigate({
            to: "/login",
            search: { redirect: location.href, reason: "expired" },
          });
        } else if (
          event.type === "logout" &&
          PRIVATE_PREFIXES.some((p) => location.pathname.startsWith(p))
        ) {
          void router.navigate({ to: "/" });
        }
      }),
    [router, queryClient],
  );

  // Expiração proativa: no instante de expirar, consulta a sessão — a API
  // responde 401 e o interceptor encerra a sessão local.
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    const timer = setTimeout(
      () => void api.auth.session().catch(() => undefined),
      Math.max(0, Math.min(ms + 250, 2_147_000_000)),
    );
    return () => clearTimeout(timer);
  }, [session]);

  return null;
}

function ConnectionBanner() {
  const { status } = useRealtime();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const show = !online || status === "reconnecting";
  return (
    <div
      role="status"
      aria-live="polite"
      className={show ? "border-b border-warning/40 bg-warning/10" : "sr-only"}
    >
      {show && (
        <p
          className="container-kurio flex items-center gap-2 py-2 text-xs text-warning"
          data-testid="connection-banner"
        >
          <WifiOff className="size-4" aria-hidden />
          {online
            ? "Conexão em tempo real interrompida. Reconectando…"
            : "Você está offline. Exibindo os últimos dados carregados."}
        </p>
      )}
    </div>
  );
}

export function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <ConnectionBanner />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer />
      <SessionWatcher />
      {import.meta.env.VITE_ENABLE_MOCKS === "true" && <ScenarioPanel />}
      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: "!bg-surface !border-line-soft !text-fg !font-sans",
            description: "!text-fg-muted",
          },
        }}
      />
    </>
  );
}
