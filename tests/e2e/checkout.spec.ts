import type { Page } from "@playwright/test";
import {
  addToCart,
  expect,
  gotoApp,
  login,
  openCart,
  test,
  USERS,
} from "./support";

async function prepareCheckout(page: Page) {
  await gotoApp(page, "/checkout");
  await expect(
    page.getByRole("heading", { name: "Pagamento", level: 1 }),
  ).toBeVisible();
  await page.getByLabel("CPF ou documento").fill("123.456.789-01");
  await page.getByTestId("connect-wallet").click();
  await expect(page.getByText(/Conectada em/)).toBeVisible();
  await page.getByTestId("review-order").click();
  await expect(page.getByTestId("confirm-order")).toBeVisible();
}

test.describe("Compra", () => {
  test("@main compra completa do catálogo ao recibo confirmado", async ({
    page,
    mock,
    isMobile,
  }) => {
    await login(page, USERS.ana);
    await gotoApp(page, "/");
    await page
      .getByTestId("nft-card-link")
      .filter({ hasText: "Emerald Ape #042" })
      .click();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByText("Adicionado!")).toBeVisible();
    await openCart(page, isMobile);
    await page.getByTestId("go-to-checkout").click();
    await expect(page).toHaveURL("/checkout");

    // Validação dos campos antes da revisão
    await page.getByTestId("connect-wallet").click();
    await expect(page.getByText(/Conectada em/)).toBeVisible();
    await page.getByTestId("review-order").click();
    await expect(page.getByLabel("CPF ou documento")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("CPF ou documento")).toBeFocused();

    await page.getByLabel("CPF ou documento").fill("123.456.789-01");
    await page.getByTestId("review-order").click();
    await page.getByTestId("confirm-order").click();

    await expect(page).toHaveURL(/\/orders\/ord_/);
    await expect(page.getByTestId("order-status-confirmed")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pedido confirmado!" }),
    ).toBeVisible();
    await expect(page.getByTestId("tx-hash")).toHaveText(/^0x[0-9a-f]{64}$/);
    await expect(page.getByTestId("receipt-lines")).toContainText(
      "Emerald Ape #042",
    );
    await expect(page.getByTestId("summary-total")).toHaveText("1.1948 ETH"); // 1.19 + 0.0048

    // Somente o item comprado sai do carrinho; o estoque é baixado
    const orders = await mock.orders();
    expect(orders.items).toHaveLength(1);
    await gotoApp(page, "/cart");
    await expect(
      page.getByRole("heading", { name: "Seu carrinho está vazio" }),
    ).toBeVisible();
    await gotoApp(page, "/nft/emerald-ape-042");
    await expect(
      page.getByText("2 de", { exact: false }).first(),
    ).toBeVisible();

    // O recibo é um snapshot: mudar o catálogo não altera o pedido
    await mock.updateNft("emerald-ape-042", {
      editionId: "standard",
      price: "9.99",
    });
    await gotoApp(page, `/orders/${orders.items[0].id}`);
    await expect(page.getByTestId("summary-total")).toHaveText("1.1948 ETH");
  });

  test("pagamento recusado preserva os itens no carrinho", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.scenario({ payment: "decline" });
    await prepareCheckout(page);
    await page.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-status-declined")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pagamento recusado" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Voltar ao carrinho" }).click();
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
  });

  test("clique repetido cria apenas um pedido", async ({ page, mock }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.scenario({ latency: "slow" });
    await prepareCheckout(page);
    const confirm = page.getByTestId("confirm-order");
    await confirm.click();
    await confirm.click({ force: true }).catch(() => undefined);
    await confirm.dispatchEvent("click").catch(() => undefined);
    await expect(page).toHaveURL(/\/orders\//, { timeout: 15_000 });
    expect((await mock.orders()).items).toHaveLength(1);
  });

  test("timeout após criar o pedido recupera o MESMO pedido (idempotência)", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.fault({
      route: "POST /api/orders",
      kind: "timeout-after-commit",
    });
    await prepareCheckout(page);
    await page.getByTestId("confirm-order").click();
    // O cliente desiste após 6 s; o servidor já criou o pedido
    await expect(page.getByTestId("order-uncertain")).toBeVisible({
      timeout: 15_000,
    });
    expect((await mock.orders()).items).toHaveLength(1);

    await page.getByTestId("retry-order").click();
    await expect(page).toHaveURL(/\/orders\//);
    await expect(page.getByTestId("order-status-confirmed")).toBeVisible();
    const orders = await mock.orders();
    expect(orders.items).toHaveLength(1);
    expect(page.url()).toContain(orders.items[0].id);
  });

  test("refresh após timeout retoma a tentativa sem duplicar", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.fault({
      route: "POST /api/orders",
      kind: "timeout-after-commit",
    });
    await prepareCheckout(page);
    await page.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-uncertain")).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page).toHaveURL(/\/orders\//);
    expect((await mock.orders()).items).toHaveLength(1);
  });

  test("carteira recusa a conexão", async ({ page, mock }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.scenario({ walletConnect: "reject" });
    await gotoApp(page, "/checkout");
    await page.getByTestId("connect-wallet").click();
    await expect(
      page.getByText(/A conexão foi recusada na carteira/),
    ).toBeVisible();
    await expect(page.getByTestId("review-order")).toBeDisabled();
  });

  test("checkout exige autenticação e retorna após o login", async ({
    page,
  }) => {
    await addToCart(page, "cosmic-bloom-118");
    await gotoApp(page, "/cart");
    await page.getByTestId("go-to-checkout").click();
    const dialog = page.getByRole("dialog", { name: "Entrar" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("E-mail").fill(USERS.ana.email);
    await dialog.getByLabel("Senha", { exact: true }).fill(USERS.ana.password);
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL("/checkout");
    await expect(page.getByText("Cosmic Bloom #118")).toBeVisible();
  });
});
