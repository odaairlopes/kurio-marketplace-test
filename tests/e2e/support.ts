import { test as base, expect, type Page } from "@playwright/test";
import type { FaultRule, MockScenario } from "../../src/api/contracts";

export const USERS = {
  ana: {
    email: "ana@kurio.test",
    password: "Kurio@123",
    name: "Ana Colecionadora",
  },
  bruno: {
    email: "bruno@kurio.test",
    password: "Kurio@123",
    name: "Bruno Lima",
  },
};

/** Cenário determinístico dos testes: sem latência, liquidação rápida. */
export const TEST_SCENARIO: Partial<MockScenario> = {
  latency: "none",
  settleDelayMs: 600,
};

/**
 * Controle da simulação. As chamadas saem do navegador (`fetch`) e passam pelo
 * Service Worker → handlers MSW — o mesmo caminho das requisições da aplicação.
 */
export class MockControl {
  constructor(private readonly page: Page) {}

  async call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.page.evaluate(
      async ({ method, path, body }) => {
        const res = await fetch(`/api/__dev${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return res.json();
      },
      { method, path, body },
    );
  }

  scenario(patch: Partial<MockScenario>) {
    return this.call("PUT", "/scenario", patch);
  }
  fault(rule: Partial<FaultRule> & Pick<FaultRule, "route" | "kind">) {
    return this.call("POST", "/faults", { times: 1, ...rule });
  }
  updateNft(
    id: string,
    body: { editionId?: string; price?: string; available?: number },
  ) {
    return this.call<{ event: { id: string; version: number } }>(
      "POST",
      `/nfts/${id}/update`,
      body,
    );
  }
  replayLast() {
    return this.call("POST", "/events/replay-last");
  }
  staleEvent(id: string, price: string) {
    return this.call("POST", `/nfts/${id}/stale-event`, { price });
  }
  dropSocket(offlineMs: number) {
    return this.call("POST", "/socket/drop", { offlineMs });
  }
  settle(orderId: string, outcome: "approve" | "decline") {
    return this.call("POST", `/orders/${orderId}/settle`, { outcome });
  }
  orders() {
    return this.call<{
      items: Array<{ id: string; status: string; userId: string }>;
    }>("GET", "/orders");
  }
  socketClients() {
    return this.call<{ clients: Array<{ userId: string | null }> }>(
      "GET",
      "/socket/clients",
    );
  }
  expireSessions() {
    return this.call("POST", "/sessions/expire");
  }
}

export async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      (window as unknown as { __KURIO_READY__?: boolean }).__KURIO_READY__ ===
      true,
  );
}

export async function gotoApp(page: Page, path: string) {
  await page.goto(path);
  await waitForApp(page);
}

export async function waitForSocket(
  page: Page,
  mock: MockControl,
  userId: string | null = null,
) {
  await expect
    .poll(
      async () =>
        (await mock.socketClients()).clients.some((c) => c.userId === userId),
      { timeout: 8_000 },
    )
    .toBe(true);
}

export async function login(
  page: Page,
  user: { email: string; password: string },
  path = "/login",
) {
  await gotoApp(page, path);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("E-mail").fill(user.email);
  await dialog.getByLabel("Senha", { exact: true }).fill(user.password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Abre o carrinho após adicionar um item: pelo header no desktop; no mobile o
 * detalhe não tem header (frame do Figma), então usa o link do aviso “Adicionado!”.
 */
export async function openCart(page: Page, isMobile: boolean) {
  if (isMobile)
    await page.getByRole("link", { name: "Ir para o carrinho" }).click();
  else await page.getByTestId("header-cart").click();
}

export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await gotoApp(page, `/nft/${nftId}`);
  const stepper = page.getByRole("spinbutton", { name: /Quantidade/ });
  if (quantity > 1) await stepper.fill(String(quantity));
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByText("Adicionado!")).toBeVisible();
}

export const test = base.extend<{ mock: MockControl }>({
  page: async ({ page }, provide) => {
    await page.addInitScript((scenario) => {
      // Apenas na primeira carga do contexto — reloads preservam o cenário alterado no teste.
      if (!localStorage.getItem("kurio.mock.scenario"))
        localStorage.setItem("kurio.mock.scenario", JSON.stringify(scenario));
    }, TEST_SCENARIO);
    await provide(page);
  },
  mock: async ({ page }, provide) => {
    await provide(new MockControl(page));
  },
});

export { expect };
