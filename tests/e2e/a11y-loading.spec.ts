import { expect, gotoApp, login, test, USERS } from "./support";

test.describe("Acessibilidade", () => {
  test("navegação por teclado, link de pular conteúdo e foco visível", async ({
    page,
  }) => {
    await gotoApp(page, "/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo/);

    // Tab chega a um card e Enter abre o detalhe
    const firstCard = page.getByTestId("nft-card-link").first();
    await firstCard.focus();
    const outline = await firstCard.evaluate(
      (el) =>
        getComputedStyle(el.closest("article")!).outlineStyle +
        getComputedStyle(el).outlineStyle,
    );
    expect(outline).toBeTruthy();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/nft\//);
  });

  test("drawer da conta prende o foco e devolve ao gatilho", async ({
    page,
  }) => {
    await login(page, USERS.ana);
    const trigger = page.getByRole("button", { name: /Menu da conta/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Minha conta" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("erros de formulário associados aos campos", async ({ page }) => {
    await gotoApp(page, "/login");
    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: "Entrar", exact: true }).click();
    const email = modal.getByLabel("E-mail");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = await email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
      /Informe um e-mail válido/,
    );
  });
});

test.describe("Carregamento e falhas", () => {
  test("skeletons durante carregamento lento", async ({ page, mock }) => {
    await gotoApp(page, "/");
    await mock.scenario({ latency: "slow" });
    await gotoApp(page, "/?tab=new");
    await expect(
      page.getByRole("list", { name: "Carregando catálogo" }),
    ).toBeVisible();
    await expect(page.locator(".skeleton").first()).toBeVisible();
    await expect(page.getByTestId("nft-card").first()).toBeVisible({
      timeout: 10_000,
    });

    await gotoApp(page, "/nft/emerald-ape-042");
    await expect(page.getByLabel("Carregando NFT")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Emerald Ape #042" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("falha do catálogo exibe erro e recupera após nova tentativa", async ({
    page,
    mock,
  }) => {
    await gotoApp(page, "/");
    // 3 falhas: requisição inicial + 2 retries automáticos
    await mock.fault({ route: "GET /api/nfts", kind: "http-500", times: 3 });
    await gotoApp(page, "/?tab=trending");
    await expect(
      page.getByRole("heading", {
        name: "Não foi possível carregar o catálogo",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByTestId("nft-card").first()).toBeVisible();
  });

  test("sem conexão com a API: feedback e recuperação", async ({
    page,
    mock,
  }) => {
    await gotoApp(page, "/");
    await mock.fault({ route: "GET /api/nfts/*", kind: "offline", times: 3 });
    await gotoApp(page, "/nft/sage-nomad-009");
    await expect(
      page.getByText("Sem conexão com o servidor. Verifique sua internet."),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Sage Nomad #009" }),
    ).toBeVisible();
  });
});

test.describe("Responsividade", () => {
  for (const width of [390, 768, 1440]) {
    test(`sem overflow horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page, USERS.ana);
      await gotoApp(page, "/nft/emerald-ape-042");
      await page.getByTestId("add-to-cart").click();
      await expect(page.getByText("Adicionado!")).toBeVisible();
      for (const path of [
        "/",
        "/nft/emerald-ape-042",
        "/cart",
        "/checkout",
        "/profile",
        "/wallets",
        "/orders/inexistente",
      ]) {
        await gotoApp(page, path);
        await page.waitForLoadState("networkidle");
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth, `${path} em ${width}px`).toBeLessThanOrEqual(
          clientWidth,
        );
      }
    });
  }
});
