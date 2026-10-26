import { useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/overlays";
import { type AuthMode, authModal, useAuthModal } from "@/lib/auth-modal";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { LoginForm, RegisterForm } from "@/pages/AuthPages";

const TABS: { mode: AuthMode; label: string }[] = [
  { mode: "login", label: "Entrar" },
  { mode: "register", label: "Criar conta" },
];

/**
 * Acesso à conta. Desktop: modal com abas. Mobile: tela cheia como os frames
 * “Login” e “Cadastro” do Figma (a troca é feita pelo link do rodapé).
 */
export function AuthModal() {
  const { open, mode, redirect, reason } = useAuthModal();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const variant = isDesktop ? "default" : "mobile";

  const onSuccess = () => {
    authModal.close();
    if (redirect) router.history.push(redirect);
  };

  const form =
    mode === "login" ? (
      <LoginForm
        reason={reason}
        variant={variant}
        onSwitch={() => authModal.setMode("register")}
        onSuccess={onSuccess}
      />
    ) : (
      <RegisterForm
        variant={variant}
        onSwitch={() => authModal.setMode("login")}
        onSuccess={onSuccess}
      />
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && authModal.close()}>
      <DialogContent className="h-dvh max-h-none w-full max-w-none gap-0 rounded-none border-0 bg-ink p-0 md:h-auto md:max-h-[90dvh] md:w-[calc(100vw-2rem)] md:max-w-[420px] md:rounded-md md:border-b-4 md:border-b-primary md:bg-surface">
        <DialogTitle className="sr-only">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Formulário de acesso à conta
        </DialogDescription>
        {isDesktop ? (
          <>
            <div
              role="tablist"
              aria-label="Acesso à conta"
              className="flex items-center justify-center gap-3 px-6 pt-8 text-lg font-bold"
            >
              {TABS.map(({ mode: m, label }, i) => (
                <div key={m} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="h-5 w-px bg-primary" />
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => authModal.setMode(m)}
                    className={cn(
                      "transition-colors hover:text-accent-text",
                      mode === m ? "text-accent-text" : "text-fg-strong",
                    )}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
            <div className="max-h-[80dvh] overflow-y-auto p-6 pt-5">
              {form}
            </div>
          </>
        ) : (
          <div className="mx-auto w-full max-w-[414px] px-7 pb-10 pt-[130px]">
            {form}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
