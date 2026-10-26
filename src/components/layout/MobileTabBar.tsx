import { Link, useRouterState } from "@tanstack/react-router";
import { Icon, type IconName } from "@/components/ui/icon";
import { authModal } from "@/lib/auth-modal";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useCart } from "@/queries/cart";

/** Recorte central da barra (Figma: 152 × 95, curva que abraça o botão flutuante). */
const NOTCH_PATH =
  "M0 0C13.75 0 25.98 8.2 31.83 20.65C39.59 37.18 56.39 48.62 75.85 48.62C95.31 48.62 112.11 37.17 119.87 20.65C125.72 8.2 137.94 0 151.7 0V95H0Z";

const TAB =
  "relative flex size-11 items-center justify-center transition-colors";

function TabIcon({ icon, active }: { icon: IconName; active: boolean }) {
  return (
    <Icon
      name={icon}
      className={cn("size-5", active ? "text-accent-text" : "text-fg-muted")}
    />
  );
}

/** Barra inferior do layout mobile (frame “Início” do Figma). */
export function MobileTabBar() {
  const session = useSession();
  const cart = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(95px+env(safe-area-inset-bottom))] drop-shadow-[0_-10px_15px_rgb(10_6_4/0.45)] md:hidden"
    >
      <div className="flex flex-1 items-start justify-between rounded-tl-[29px] bg-surface pl-6.5 pt-7">
        <Link
          to="/"
          aria-label="Início"
          className={TAB}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <TabIcon icon="mobile-home" active={pathname === "/"} />
        </Link>
        <Link
          to="/profile"
          hash="profile-favorites"
          aria-label="Favoritos"
          className={cn(TAB, "-mr-2")}
        >
          <TabIcon icon="mobile-favorite" active={false} />
        </Link>
      </div>

      <div className="relative w-[152px] shrink-0">
        <svg
          aria-hidden
          viewBox="0 0 151.7 95"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 h-[95px] w-full fill-surface"
        >
          <path d={NOTCH_PATH} />
        </svg>
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[95px] bg-surface" />
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar coleções"
          className="absolute left-1/2 top-[-31px] flex size-[65px] -translate-x-1/2 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgb(210_138_76/0.4)_0%,var(--color-brand)_100%)] text-fg transition-transform active:scale-95"
        >
          <Icon name="mobile-group" className="h-6 w-[27px]" />
        </Link>
      </div>

      <div className="flex flex-1 items-start justify-between rounded-tr-[29px] bg-surface pr-6.5 pt-7">
        <Link
          to="/cart"
          aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
          className={cn(TAB, "-ml-2")}
          aria-current={pathname === "/cart" ? "page" : undefined}
        >
          <TabIcon icon="mobile-shop" active={pathname === "/cart"} />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute right-0.5 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
            >
              {count}
            </span>
          )}
        </Link>
        {session ? (
          <Link
            to="/profile"
            aria-label="Conta"
            className={TAB}
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <TabIcon icon="mobile-user" active={pathname === "/profile"} />
          </Link>
        ) : (
          <button
            type="button"
            aria-label="Entrar"
            onClick={() => authModal.open("login")}
            className={TAB}
          >
            <TabIcon icon="mobile-user" active={false} />
          </button>
        )}
      </div>
    </nav>
  );
}
