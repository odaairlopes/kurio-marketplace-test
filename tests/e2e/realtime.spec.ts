import {
  addToCart,
  expect,
  gotoApp,
  login,
  test,
  USERS,
  waitForSocket,
} from "./support";

test.describe("Tempo real (Socket.IO)", () => {
  test("@main preço alterado durante o checkout exige nova confirmação", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "emerald-ape-042");

    // No carrinho: aviso e resumo atualizado
    await gotoApp(page, "/cart");
    await waitForSocket(page, mock, "usr_ana");
    await mock.updateNft("emerald-ape-042", {
      editionId: "standard",
      price: "1.25",
    });
    await expect(page.getByTestId("price-changed-notice")).toContainText(
      "1.19 ETH",
    );
    await expect(page.getByTestId("summary-subtotal")).toHaveText("1.25 ETH");

    // No checkout: a cotação revisada fica desatualizada
    await page.getByTestId("go-to-checkout").click();
    await page.getByLabel("CPF ou documento").fill("123.456.789-01");
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("review-order").click();
    await expect(page.getByTestId("confirm-order")).toContainText("1.2548");

    await mock.updateNft("emerald-ape-042", {
      editionId: "standard",
      price: "1.40",
    });
    await expect(page.getByTestId("stale-quote")).toBeVisible();
    await expect(page.getByTestId("stale-quote")).toContainText(
      "1.25 ETH → 1.40 ETH",
    );
    await expect(page.getByTestId("confirm-order")).toHaveCount(0);

    await page.getByTestId("accept-new-quote").click();
    await expect(page.getByTestId("confirm-order")).toContainText("1.4048");
    await page.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-status-confirmed")).toBeVisible();
    await expect(page.getByTestId("summary-total")).toHaveText("1.4048 ETH");
  });

  test("edição esgotada no carrinho bloqueia o checkout", async ({
    page,
    mock,
  }) => {
    await addToCart(page, "emerald-ape-042");
    await gotoApp(page, "/cart");
    await waitForSocket(page, mock);
    await mock.updateNft("emerald-ape-042", {
      editionId: "standard",
      available: 0,
    });
    await expect(page.getByTestId("stock-notice")).toContainText(
      "Edição esgotada",
    );
    await expect(page.getByTestId("go-to-checkout")).toBeDisabled();
  });

  test("eventos duplicados ou antigos não regridem o estado", async ({
    page,
    mock,
  }) => {
    await gotoApp(page, "/nft/emerald-ape-042");
    await waitForSocket(page, mock);
    await mock.updateNft("emerald-ape-042", {
      editionId: "standard",
      price: "1.30",
    });
    await expect(page.getByTestId("nft-price")).toHaveText("1.30 ETH");

    await mock.replayLast();
    await mock.staleEvent("emerald-ape-042", "0.01");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("nft-price")).toHaveText("1.30 ETH");

    // Catálogo também reflete o evento
    await page.goBack().catch(() => undefined);
    await gotoApp(page, "/");
    await expect(
      page
        .getByTestId("nft-card")
        .filter({ hasText: "Emerald Ape #042" })
        .getByTestId("nft-card-price"),
    ).toHaveText("1.30 ETH");
  });

  test("desconexão com pedido pendente: reconexão reconcilia sem nova compra", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.scenario({ settleDelayMs: null }); // liquidação manual
    await gotoApp(page, "/checkout");
    await page.getByLabel("CPF ou documento").fill("123.456.789-01");
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("review-order").click();
    await page.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-status-pending")).toBeVisible();
    const orderId = page.url().split("/orders/")[1];

    // Queda da conexão; o pedido é confirmado enquanto o cliente está offline
    await waitForSocket(page, mock, "usr_ana");
    await mock.dropSocket(2_000);
    await expect(page.getByTestId("connection-banner")).toBeVisible();
    await mock.settle(orderId, "approve");
    await expect(page.getByTestId("order-status-confirmed")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("connection-banner")).toHaveCount(0, {
      timeout: 10_000,
    });
    expect((await mock.orders()).items).toHaveLength(1);
  });

  test("refresh com pedido pendente recupera o estado e recebe a confirmação via evento", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await addToCart(page, "cosmic-bloom-118");
    await mock.scenario({ settleDelayMs: null });
    await gotoApp(page, "/checkout");
    await page.getByLabel("CPF ou documento").fill("123.456.789-01");
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("review-order").click();
    await page.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-status-pending")).toBeVisible();
    const orderId = page.url().split("/orders/")[1];

    await page.reload();
    await expect(page.getByTestId("order-status-pending")).toBeVisible();
    await waitForSocket(page, mock, "usr_ana");
    await mock.settle(orderId, "decline");
    await expect(page.getByTestId("order-status-declined")).toBeVisible();
    // Terminal: nova liquidação não altera o estado
    await mock.settle(orderId, "approve");
    await page.waitForTimeout(300);
    await expect(page.getByTestId("order-status-declined")).toBeVisible();
    expect((await mock.orders()).items).toHaveLength(1);
  });

  test("eventos de pedido não chegam a outro usuário", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.bruno);
    await gotoApp(page, "/profile");
    await waitForSocket(page, mock, "usr_bruno");
    const clients = (await mock.socketClients()).clients;
    expect(clients.every((c) => c.userId !== "usr_ana")).toBe(true);
  });
});
