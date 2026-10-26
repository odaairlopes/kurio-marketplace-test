import {
  addToCart,
  expect,
  gotoApp,
  login,
  openCart,
  test,
  USERS,
} from "./support";

test.describe("Favoritos", () => {
  test("favoritar persiste; falha da mutation faz rollback e permite nova tentativa", async ({
    page,
    mock,
  }) => {
    await login(page, USERS.ana);
    await gotoApp(page, "/nft/emerald-ape-042");
    const fav = page.getByTestId("favorite-emerald-ape-042");
    await expect(fav).toHaveAttribute("aria-pressed", "false");
    await fav.click();
    await expect(fav).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(fav).toHaveAttribute("aria-pressed", "true");

    // Falha: atualização otimista é revertida
    await mock.fault({ route: "DELETE /api/favorites/*", kind: "http-500" });
    await fav.click();
    await expect(
      page.getByText(/Não foi possível remover dos favoritos/),
    ).toBeVisible();
    await expect(fav).toHaveAttribute("aria-pressed", "true");

    // Recuperação
    await fav.click();
    await expect(fav).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(fav).toHaveAttribute("aria-pressed", "false");
  });

  test("visitante é levado ao login ao favoritar", async ({ page }) => {
    await gotoApp(page, "/nft/emerald-ape-042");
    await page.getByTestId("favorite-emerald-ape-042").click();
    await expect(page.getByRole("dialog", { name: "Entrar" })).toBeVisible();
  });
});

test.describe("Carrinho", () => {
  test("@main quantidades, cupom, resumo, refresh e preservação ao autenticar", async ({
    page,
    isMobile,
  }) => {
    await addToCart(page, "emerald-ape-042", 2);
    await addToCart(page, "cosmic-bloom-118", 1);
    await openCart(page, isMobile);
    await expect(page.getByTestId("cart-item")).toHaveCount(2);
    await expect(page.getByTestId("summary-subtotal")).toHaveText("3.67 ETH"); // 2×1.19 + 1.29

    // Limite de quantidade (3 disponíveis)
    const row = page
      .getByTestId("cart-item")
      .filter({ hasText: "Emerald Ape #042" });
    await row.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(row.getByRole("spinbutton")).toHaveValue("3");
    await expect(
      row.getByRole("button", { name: "Aumentar quantidade" }),
    ).toBeDisabled();
    await expect(page.getByTestId("summary-subtotal")).toHaveText("4.86 ETH");

    // Cupons
    const coupon = page.getByLabel("Cupom de desconto");
    await coupon.fill("NAOEXISTE");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page.getByText("Cupom inválido.")).toBeVisible();
    await expect(coupon).toHaveAttribute("aria-invalid", "true");
    await coupon.fill("VERAO20");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page.getByText("Este cupom expirou.")).toBeVisible();
    await coupon.fill("kurio10");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(
      page.getByText(/Cupom KURIO10 aplicado/).first(),
    ).toBeVisible();
    // 4.86 − 10% (0.486) + taxa Ethereum (0.0042 + 2×0.0006 = 0.0054) = 4.3794
    await expect(page.getByTestId("summary-discount")).toHaveText("−0.486 ETH");
    await expect(page.getByTestId("summary-fee")).toHaveText("0.0054 ETH");
    await expect(page.getByTestId("summary-total")).toHaveText("4.3794 ETH");

    // Refresh mantém o carrinho
    await page.reload();
    await expect(page.getByTestId("cart-item")).toHaveCount(2);
    await expect(page.getByTestId("summary-total")).toHaveText("4.3794 ETH");

    // Login preserva os itens do visitante
    await login(page, USERS.bruno, "/login?redirect=%2Fcart");
    await expect(page).toHaveURL("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(2);
    await expect(page.getByText(/KURIO10/).first()).toBeVisible();

    // Remoção
    await page
      .getByRole("button", { name: "Remover Cosmic Bloom #118 do carrinho" })
      .click();
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Remover Emerald Ape #042 do carrinho" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Seu carrinho está vazio" }),
    ).toBeVisible();
  });

  test("remover cupom e trocar a rede recalcula a taxa", async ({ page }) => {
    await addToCart(page, "emerald-ape-042", 1);
    await gotoApp(page, "/cart");
    await page.getByLabel("Cupom de desconto").fill("BEMVINDO5");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page.getByTestId("summary-discount")).toHaveText(
      "−0.0595 ETH",
    );
    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await expect(page.getByTestId("summary-discount")).toHaveText("0.00 ETH");
    await page.getByLabel("Rede de pagamento").selectOption("polygon");
    await expect(page.getByTestId("summary-fee")).toHaveText("0.0009 ETH");
  });
});
