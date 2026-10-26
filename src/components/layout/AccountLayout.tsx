import { Link, useNavigate } from "@tanstack/react-router";
import { BadgePercent } from "lucide-react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useLogout } from "@/queries/account";

type Item =
  | {
      label: string;
      icon: IconName;
      to: "/profile" | "/wallets";
      hash?: string;
    }
  | { label: string; icon: IconName | "offers" };

const ITEMS: Item[] = [
  { label: "Dados do perfil", icon: "user", to: "/profile" },
  { label: "Carteiras", icon: "location", to: "/wallets" },
  { label: "Atividade", icon: "activity" },
  {
    label: "Lista de interesse",
    icon: "heart",
    to: "/profile",
    hash: "profile-favorites",
  },
  { label: "Ofertas", icon: "offers" },
  { label: "Arquivos baixados", icon: "download" },
  { label: "Suporte", icon: "danger-triangle" },
];

const ROW =
  "flex shrink-0 items-center gap-3 whitespace-nowrap border-b-4 border-transparent px-4 py-3 text-sm lg:border-b-0 lg:border-l-4";

function ItemIcon({ icon }: { icon: IconName | "offers" }) {
  return icon === "offers" ? (
    <BadgePercent className="size-4" aria-hidden />
  ) : (
    <Icon name={icon} className="size-4" />
  );
}

/** Estrutura "Meu perfil" do Figma: menu lateral + conteúdo da conta. */
export function AccountLayout({
  active,
  children,
}: {
  active: "/profile" | "/wallets";
  children: React.ReactNode;
}) {
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="container-kurio grid items-start gap-8 pt-8 lg:grid-cols-[250px_1fr]">
      <nav aria-label="Meu perfil" className="min-w-0 rounded-md bg-surface">
        <p className="hidden px-4 pb-3 pt-5 text-lg font-bold lg:block">
          Meu perfil
        </p>
        <ul className="flex overflow-x-auto lg:block lg:overflow-visible">
          {ITEMS.map((item) => (
            <li key={item.label}>
              {"to" in item ? (
                <Link
                  to={item.to}
                  hash={item.hash}
                  aria-current={
                    item.to === active && !item.hash ? "page" : undefined
                  }
                  className={cn(
                    ROW,
                    "hover:text-accent-text",
                    item.to === active && !item.hash
                      ? "border-primary text-accent-text"
                      : "text-fg",
                  )}
                >
                  <ItemIcon icon={item.icon} /> {item.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="Fora do escopo desta demonstração"
                  className={cn(ROW, "cursor-not-allowed text-fg-muted/70")}
                >
                  <ItemIcon icon={item.icon} /> {item.label}
                </span>
              )}
            </li>
          ))}
          <li className="shrink-0 lg:border-t lg:border-line">
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSettled: () => void navigate({ to: "/" }),
                })
              }
              className={cn(
                ROW,
                "w-full font-bold text-accent-text hover:underline",
              )}
            >
              <Icon name="logout" className="size-4" /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </div>
  );
}
