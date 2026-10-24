import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  User,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";
import { useSession } from "@/lib/session";
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
        "text-2xl font-bold tracking-[0.2em] text-fg-strong",
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
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link
        to="/cart"
        aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
        data-testid="header-cart"
      >
        <ShoppingBag aria-hidden />
        {count > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
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
      <Button asChild variant="ghost" size="icon">
        <Link
          to="/login"
          search={{ redirect: pathname === "/login" ? undefined : pathname }}
          aria-label="Entrar na conta"
        >
          <User aria-hidden />
        </Link>
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
            <User className="size-4" aria-hidden /> Perfil do colecionador
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
            <ShoppingBag className="size-4" aria-hidden /> Carrinho
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
          <LogOut aria-hidden /> Sair
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
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center gap-2 rounded-md px-3 py-3 hover:bg-surface"
            >
              <LogIn className="size-4" aria-hidden /> Entrar
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function Header() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const isHome = location.pathname === "/";

  const focusSearch = async () => {
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
    <header className="border-b border-line">
      <div className="container-kurio flex h-18 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MobileMenu />
          <Logo />
        </div>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-10">
            {NAV.map((item) => {
              const active =
                item.enabled &&
                item.label === "Início" &&
                isHome &&
                !location.hash;
              return (
                <li key={item.label}>
                  {item.enabled ? (
                    <Link
                      to="/"
                      hash={item.hash}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative py-2 text-[15px] transition-colors hover:text-accent-text",
                        active
                          ? "font-bold text-accent-text after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-accent-text"
                          : "text-fg",
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      title="Em breve"
                      className="cursor-not-allowed text-[15px] text-fg-muted/70"
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buscar NFTs"
            onClick={focusSearch}
          >
            <Search aria-hidden />
          </Button>
          <CartLink />
          <AccountDrawer />
        </div>
      </div>
    </header>
  );
}
