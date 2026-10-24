import type { Page } from "@playwright/test";
import { addToCart, expect, gotoApp, login, test, USERS } from "./support";

/** Remove elementos voláteis (toasts e botão de cenários) antes do snapshot. */
async function stabilize(page: Page) {
  await page.addStyleTag({
    content:
      '[data-sonner-toaster], [data-testid="scenario-panel-trigger"] { display: none !important; }',
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete),
  );
}

test.describe("@visual Regressão visual", () => {
  test("início", async ({ page }) => {
    await gotoApp(page, "/");
    await expect(page.getByTestId("nft-card")).toHaveCount(9);
    await stabilize(page);
    await expect(page).toHaveScreenshot("inicio.png", { fullPage: true });
  });

  test("detalhe", async ({ page }) => {
    await gotoApp(page, "/nft/emerald-ape-042");
    await expect(page.getByTestId("nft-price")).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot("detalhe.png", { fullPage: true });
  });

  test("carrinho", async ({ page }) => {
    await addToCart(page, "emerald-ape-042", 2);
    await gotoApp(page, "/cart");
    await expect(page.getByTestId("summary-total")).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot("carrinho.png", { fullPage: true });
  });

  test("pagamento", async ({ page }) => {
    await login(page, USERS.ana);
    await addToCart(page, "emerald-ape-042");
    await gotoApp(page, "/checkout");
    await expect(page.getByTestId("summary-total")).toBeVisible();
    await expect(page.getByTestId("connect-wallet")).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot("pagamento.png", { fullPage: true });
  });
});
