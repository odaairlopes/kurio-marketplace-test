import { Link, useRouterState } from "@tanstack/react-router";
import { authModal } from "@/lib/auth-modal";
import { Icon, type IconName } from "@/components/ui/icon";
import { useSession } from "@/lib/session";
import { useCart } from "@/queries/cart";
import { cn } from "@/lib/utils";

const TAB =
  "flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium";

/** Barra inferior do layout mobile (ícones do Figma). */
export function MobileTabBar() {
  const session = useSession();
  const cart = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  const state = (active: boolean) =>
    active ? "text-accent-text" : "text-fg-muted";

  const Label = ({ icon, label }: { icon: IconName; label: string }) => (
    <>
      <Icon name={icon} className="size-6" />
      {label}
    </>
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex rounded-t-3xl border-t border-line bg-surface md:hidden"
    >
      <Link
        to="/"
        className={cn(TAB, state(pathname === "/"))}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <Label icon="mobile-home" label="Início" />
      </Link>
      <Link
        to="/profile"
        hash="profile-favorites"
        className={cn(TAB, state(false))}
      >
        <Label icon="mobile-favorite" label="Favoritos" />
      </Link>
      <Link
        to="/cart"
        className={cn(TAB, "relative", state(pathname === "/cart"))}
        aria-current={pathname === "/cart" ? "page" : undefined}
      >
        <Label icon="mobile-shop" label="Carrinho" />
        {count > 0 && (
          <span className="absolute right-[28%] top-2 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </Link>
      {session ? (
        <Link
          to="/profile"
          className={cn(TAB, state(pathname === "/profile"))}
          aria-current={pathname === "/profile" ? "page" : undefined}
        >
          <Label icon="mobile-user" label="Conta" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => authModal.open("login")}
          className={cn(TAB, state(false))}
        >
          <Label icon="mobile-user" label="Entrar" />
        </button>
      )}
    </nav>
  );
}
