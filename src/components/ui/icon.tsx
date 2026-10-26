import activity from "@/assets/icons/activity.svg";
import cart from "@/assets/icons/cart.svg";
import dangerTriangle from "@/assets/icons/danger-triangle.svg";
import download from "@/assets/icons/download.svg";
import heart from "@/assets/icons/heart.svg";
import location from "@/assets/icons/location.svg";
import logout from "@/assets/icons/logout.svg";
import mobileFavorite from "@/assets/icons/mobile-favorite.svg";
import mobileFilter from "@/assets/icons/mobile-filter.svg";
import mobileGroup from "@/assets/icons/mobile-group.svg";
import mobileHome from "@/assets/icons/mobile-home.svg";
import mobileShop from "@/assets/icons/mobile-shop.svg";
import mobileUser from "@/assets/icons/mobile-user.svg";
import user from "@/assets/icons/user.svg";
import { cn } from "@/lib/utils";

const ICONS = {
  activity,
  cart,
  "danger-triangle": dangerTriangle,
  download,
  heart,
  location,
  logout,
  "mobile-favorite": mobileFavorite,
  "mobile-filter": mobileFilter,
  "mobile-group": mobileGroup,
  "mobile-home": mobileHome,
  "mobile-shop": mobileShop,
  "mobile-user": mobileUser,
  user,
};

export type IconName = keyof typeof ICONS;

/** Ícone SVG da marca; usa máscara para herdar a cor do texto (currentColor). */
export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const mask = `url("${ICONS[name]}") center / contain no-repeat`;
  return (
    <span
      aria-hidden
      className={cn("inline-block size-5 shrink-0 bg-current", className)}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
