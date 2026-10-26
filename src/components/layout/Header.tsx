import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { authModal } from "@/lib/auth-modal";
import { useSession } from "@/lib/session";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { useLogout } from "@/queries/account";
import { useCart } from "@/queries/cart";
import { Avatar } from "./Avatar";

const NAV = [
  { label: "Início", to: "/" as const, enabled: true },
  { label: "Mercado", to: "/" as const, hash: "catalogo", enabled: true },
  { label: "Criadores", enabled: false },
  { label: "Aprenda", enabled: false },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "mt-3.5 text-sm font-bold tracking-[0.13em] text-fg-strong",
        className,
      )}
      aria-label="KURIO — página inicial"
    >
      KURIO
    </Link>
  );
}

function CartLink() {
  const cart = useCart();
  const count = cart.data?.items.reduce((acc, i) => acc + i.quantity, 0) ?? 0;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative size-11 hover:bg-transparent"
    >
      <Link
        to="/cart"
        aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
        data-testid="header-cart"
      >
        <Icon name="cart" className="size-6" />
        {count > 0 && (
          <span
            className="absolute right-0.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold leading-none text-primary-foreground"
            aria-hidden
          >
            {count}
          </span>
        )}
      </Link>
    </Button>
  );
}

function AccountDrawer() {
  const session = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.href });

  if (!session) {
    return (
      <Button
        type="button"
        onClick={() => authModal.open("login", { redirect: pathname })}
        aria-label="Entrar na conta"
        className="ml-6 h-[35px] gap-1.5 px-3 text-base font-bold normal-case tracking-normal"
      >
        <Icon name="logout" />
        Entrar
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="rounded-full p-0.5 hover:ring-2 hover:ring-accent-text/50"
          aria-label={`Menu da conta de ${session.user.displayName}`}
          data-testid="account-menu"
        >
          <Avatar user={session.user} size={36} />
        </button>
      </SheetTrigger>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetTitle className="text-lg font-bold">Minha conta</SheetTitle>
        <div className="flex items-center gap-3 rounded-lg border border-line p-3">
          <Avatar user={session.user} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{session.user.displayName}</p>
            <p className="truncate text-sm text-fg-muted">
              @{session.user.handle}
            </p>
          </div>
        </div>
        <nav aria-label="Conta" className="flex flex-col gap-1">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-surface"
          >
            <Icon name="user" className="size-4" /> Perfil do colecionador
          </Link>
          <Link
            to="/wallets"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-surface"
          >
            <Wallet className="size-4" aria-hidden /> Carteiras
          </Link>
          <Link
            to="/cart"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-surface"
          >
            <Icon name="cart" className="size-4" /> Carrinho
          </Link>
        </nav>
        <Button
          variant="outline"
          className="mt-auto"
          loading={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => {
                setOpen(false);
                void navigate({ to: "/" });
              },
            })
          }
        >
          <Icon name="logout" /> Sair
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const session = useSession();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menu"
        >
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle className="text-xl font-bold tracking-[0.2em]">
          KURIO
        </SheetTitle>
        <SheetDescription className="sr-only">
          Navegação principal
        </SheetDescription>
        <nav aria-label="Principal (mobile)" className="flex flex-col gap-1">
          {NAV.map((item) =>
            item.enabled ? (
              <Link
                key={item.label}
                to="/"
                hash={item.hash}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 hover:bg-surface"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between rounded-md px-3 py-3 text-fg-muted/70"
              >
                {item.label}{" "}
                <span className="text-[11px] uppercase">Em breve</span>
              </span>
            ),
          )}
          {!session && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                authModal.open("login");
              }}
              className="mt-4 flex w-full items-center gap-2 rounded-md px-3 py-3 text-left hover:bg-surface"
            >
              <Icon name="logout" className="size-4" /> Entrar
            </button>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function HeaderSearchBar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  return (
    <div className="border-b border-line bg-ink">
      <form
        role="search"
        className="container-kurio flex items-center gap-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          const q = draft.trim();
          void navigate({
            to: "/",
            search: (prev: Record<string, unknown>) => ({
              ...prev,
              q: q || undefined,
              page: undefined,
            }),
            hash: "catalogo",
          });
          onClose();
        }}
      >
        <label htmlFor="header-search" className="sr-only">
          Buscar NFTs por nome, criador ou token
        </label>
        <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
        <Input
          id="header-search"
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="Buscar NFTs, criadores…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10 border-line-soft"
        />
        <Button type="submit" className="h-10 px-5 normal-case tracking-normal">
          Buscar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar busca"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </form>
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const isHome = location.pathname === "/";
  const isDesktop = useIsDesktop();
  const [searchOpen, setSearchOpen] = useState(false);

  const focusSearch = async () => {
    if (isDesktop) {
      setSearchOpen((v) => !v);
      return;
    }
    if (!isHome) await navigate({ to: "/" });
    requestAnimationFrame(() => {
      const input = document.getElementById(
        "catalog-search",
      ) as HTMLInputElement | null;
      input?.scrollIntoView({ block: "center" });
      input?.focus();
    });
  };

  return (
    <header>
      <div className="container-kurio relative flex h-17 items-center justify-between gap-4 border-b border-[#442c1a]">
        <div className="flex items-center gap-2">
          <MobileMenu />
          <Logo />
        </div>
        <nav
          aria-label="Principal"
          className="hidden h-full pt-0.5 md:block xl:absolute xl:left-94 xl:top-0"
        >
          <ul className="flex h-full items-center gap-10">
            {NAV.map((item) => {
              const active =
                item.enabled &&
                item.label === "Início" &&
                isHome &&
                !location.hash;
              return (
                <li key={item.label} className="h-full">
                  {item.enabled ? (
                    <Link
                      to="/"
                      hash={item.hash}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-full items-center text-base transition-colors hover:text-accent-text",
                        active
                          ? "font-bold text-accent-text after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-accent-text"
                          : "text-fg",
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      title="Em breve"
                      className="flex h-full cursor-not-allowed items-center text-base text-fg"
                    >
                      {item.label}
                      <span className="sr-only"> (em breve)</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-4 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 hover:bg-transparent"
            aria-label="Buscar NFTs"
            aria-expanded={isDesktop ? searchOpen : undefined}
            onClick={focusSearch}
          >
            <Search className="size-6!" strokeWidth={1.75} aria-hidden />
          </Button>
          <CartLink />
          <AccountDrawer />
        </div>
      </div>
      {isDesktop && searchOpen && (
        <HeaderSearchBar onClose={() => setSearchOpen(false)} />
      )}
    </header>
  );
}
