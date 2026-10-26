/**
 * Painel de cenários da demonstração. Todas as ações chamam os endpoints
 * /api/__dev do MSW via Axios — nada é injetado direto na UI ou no cache.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { MockScenario } from "@/api/contracts";
import { api } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";
import { useCart } from "@/queries/cart";
import { mul } from "@/lib/money";

const PRESET_LABEL: Record<string, string> = {
  default: "Padrão (latência realista)",
  fast: "Rápido",
  slow: "Lento (2,5 s)",
  "out-of-order": "Respostas fora de ordem",
  empty: "Catálogo vazio",
  "catalog-error": "Catálogo com erro 500",
  offline: "Sem conexão (todas as APIs)",
  "payment-declined": "Pagamento recusado",
  "wallet-rejected": "Carteira recusa conexão",
  "order-timeout": "Timeout após criar pedido",
  "favorites-fail": "Favoritos falham",
  "short-session": "Sessão de 1 minuto",
};

export function ScenarioPanel() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const cart = useCart();
  const scenario = useQuery({
    queryKey: ["__dev", "scenario"],
    queryFn: api.dev.scenario,
    enabled: open,
  });
  const current = scenario.data?.scenario;

  const run = async (
    label: string,
    action: () => Promise<unknown>,
    refresh = true,
  ) => {
    try {
      await action();
      toast.info(`Cenário: ${label}`);
      await scenario.refetch();
      if (refresh) await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(`Falha ao aplicar cenário: ${(error as Error).message}`);
    }
  };

  const update = (patch: Partial<MockScenario>) =>
    run("configuração atualizada", () => api.dev.updateScenario(patch));
  const firstCartItem = cart.data?.items[0];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-24 left-4 z-40 md:bottom-4 flex items-center gap-2 rounded-full border border-line-soft bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg-muted shadow-lg hover:text-accent-text"
          data-testid="scenario-panel-trigger"
        >
          <FlaskConical className="size-4" aria-hidden /> Cenários
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="gap-5 text-sm">
        <div>
          <SheetTitle className="text-lg font-bold">
            Cenários da simulação
          </SheetTitle>
          <SheetDescription className="mt-1 text-fg-muted">
            Controla a API simulada (MSW) e os eventos Socket.IO. As mudanças
            passam pela camada de rede.
          </SheetDescription>
        </div>

        <section className="flex flex-col gap-2">
          <Label htmlFor="preset">Preset</Label>
          <NativeSelect
            id="preset"
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              run(PRESET_LABEL[e.target.value], () =>
                api.dev.preset(e.target.value),
              )
            }
          >
            <option value="">Selecione…</option>
            {(scenario.data?.presets ?? Object.keys(PRESET_LABEL)).map((p) => (
              <option key={p} value={p}>
                {PRESET_LABEL[p] ?? p}
              </option>
            ))}
          </NativeSelect>
        </section>

        {current && (
          <section className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="latency">Latência</Label>
              <NativeSelect
                id="latency"
                value={current.latency}
                onChange={(e) =>
                  update({ latency: e.target.value as MockScenario["latency"] })
                }
              >
                <option value="none">Nenhuma</option>
                <option value="fast">Rápida</option>
                <option value="realistic">Realista (variável)</option>
                <option value="slow">Lenta</option>
                <option value="out-of-order">Fora de ordem</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="payment">Pagamento</Label>
              <NativeSelect
                id="payment"
                value={current.payment}
                onChange={(e) =>
                  update({ payment: e.target.value as MockScenario["payment"] })
                }
              >
                <option value="approve">Aprovar</option>
                <option value="decline">Recusar</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wallet">Carteira</Label>
              <NativeSelect
                id="wallet"
                value={current.walletConnect}
                onChange={(e) =>
                  update({
                    walletConnect: e.target
                      .value as MockScenario["walletConnect"],
                  })
                }
              >
                <option value="approve">Aceita conexão</option>
                <option value="reject">Recusa conexão</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="catalog">Catálogo</Label>
              <NativeSelect
                id="catalog"
                value={current.catalog}
                onChange={(e) =>
                  update({ catalog: e.target.value as MockScenario["catalog"] })
                }
              >
                <option value="default">Padrão</option>
                <option value="empty">Vazio</option>
              </NativeSelect>
            </div>
            <p className="col-span-2 text-xs text-fg-muted">
              Falhas ativas:{" "}
              {current.faults.length
                ? current.faults.map((f) => `${f.route} → ${f.kind}`).join("; ")
                : "nenhuma"}
            </p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <p className="font-bold">Tempo real (Socket.IO)</p>
          <Button
            variant="outline"
            size="sm"
            disabled={!firstCartItem}
            onClick={() =>
              firstCartItem &&
              run(
                "preço alterado",
                () =>
                  api.dev.updateNft(firstCartItem.nftId, {
                    editionId: firstCartItem.editionId,
                    price: mul(firstCartItem.unitPrice, "1.1").replace(
                      /(\.\d{4})\d+$/,
                      "$1",
                    ),
                  }),
                false,
              )
            }
          >
            Subir preço do 1º item do carrinho (+10%)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!firstCartItem}
            onClick={() =>
              firstCartItem &&
              run(
                "edição esgotada",
                () =>
                  api.dev.updateNft(firstCartItem.nftId, {
                    editionId: firstCartItem.editionId,
                    available: 0,
                  }),
                false,
              )
            }
          >
            Esgotar edição do 1º item do carrinho
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run("evento duplicado reenviado", api.dev.replayLast, false)
            }
          >
            Reenviar último evento (duplicata)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run(
                "queda de conexão por 5 s",
                () => api.dev.dropSocket(5000),
                false,
              )
            }
          >
            Derrubar conexão por 5 s
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <p className="font-bold">Sessão e dados</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run("sessões expiradas", api.dev.expireSessions, false)
            }
          >
            Expirar sessão no servidor
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("falhas removidas", api.dev.clearFaults)}
          >
            Limpar falhas injetadas
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await api.dev.reset();
              localStorage.removeItem("kurio.session");
              localStorage.removeItem("kurio.cartId");
              sessionStorage.clear();
              window.location.assign("/");
            }}
          >
            Resetar todos os dados
          </Button>
        </section>
      </SheetContent>
    </Sheet>
  );
}
