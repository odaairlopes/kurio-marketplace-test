import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { RefreshCw, SearchX, ServerCrash } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-soft px-6 py-16 text-center">
      <span className="text-fg-muted" aria-hidden>
        {icon ?? <SearchX className="size-10" />}
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && (
        <p className="max-w-md text-sm leading-6 text-fg-muted">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Não foi possível carregar",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-6 py-12 text-center"
    >
      <ServerCrash className="size-10 text-danger" aria-hidden />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function NotFound({
  title = "Página não encontrada",
  description,
}: { title?: string; description?: string } = {}) {
  return (
    <section
      className="container-kurio flex flex-col items-center gap-4 py-24 text-center"
      aria-labelledby="not-found-title"
    >
      <p className="text-6xl font-bold text-accent-text" aria-hidden>
        404
      </p>
      <h1 id="not-found-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p className="max-w-md text-fg-muted">
        {description ?? "O endereço acessado não existe ou foi removido."}
      </p>
      <Button asChild>
        <Link to="/">Voltar ao mercado</Link>
      </Button>
    </section>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  return (
    <div className="container-kurio py-16">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
