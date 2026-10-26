import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botão circular 34 px dos frames mobile (voltar, favoritar). */
export const CIRCLE_BUTTON =
  "flex size-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised transition-colors hover:border-line-soft";

/** Volta no histórico; sem histórico (acesso direto), vai para `fallback`. */
export function BackButton({
  fallback = "/",
  className,
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() =>
        canGoBack
          ? router.history.back()
          : void router.navigate({ to: fallback })
      }
      className={cn(CIRCLE_BUTTON, "text-brand-secondary", className)}
    >
      <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/** Barra superior das telas mobile: voltar + título centralizado no espaço restante. */
export function MobileTopBar({
  title,
  fallback,
}: {
  title: string;
  fallback?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-8">
      <BackButton fallback={fallback} />
      <h1 className="flex-1 truncate text-center text-xl font-bold text-fg">
        {title}
      </h1>
    </div>
  );
}
