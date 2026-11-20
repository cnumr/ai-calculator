import { expect, test } from "@playwright/test";

test("guided tour: loaded on demand, 8 steps on the real calculator", async ({ page }) => {
  const tourRequests: string[] = [];
  page.on("request", (request) => {
    if (/GuidedTour/.test(request.url())) tourRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator(".use-case-card").first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  const button = page.getByRole("button", { name: /^(visite guidée|guided tour)/i });
  await expect(button).toHaveClass(/calculator-tour-button--invite/);
  // Nothing of the tour is loaded before the click (RWEB_0046).
  expect(tourRequests).toHaveLength(0);

  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(tourRequests.length).toBeGreaterThan(0);

  for (let step = 1; step <= 8; step += 1) {
    await expect(dialog).toContainText(`${step} / 8`);
    // The outlined element and the bubble are both on screen.
    const target = page.locator("[data-tour-active]");
    await expect(target).toHaveCount(1);
    await expect(target).toBeInViewport();
    await expect(dialog).toBeInViewport();
    await dialog
      .getByRole("button", { name: step === 8 ? /terminer|finish/i : /suivant|next/i })
      .click();
  }

  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-tour-active]")).toHaveCount(0);
  await expect(button).toBeFocused();

  // Once taken, the tour no longer invites, even after a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: /^(visite guidée|guided tour)$/i })).not.toHaveClass(
    /calculator-tour-button--invite/,
  );
});
