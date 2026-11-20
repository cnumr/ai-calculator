import { expect, test } from "@playwright/test";

test("no third party: fonts are served by the site itself", async ({ page, baseURL }) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto("/");
  await expect(page.locator(".use-case-card").first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Only the site and its API: no Google Fonts, nor any other domain.
  const allowed = [new URL(baseURL!).origin, "http://127.0.0.1:8000", "http://localhost:8000"];
  expect([...origins].filter((origin) => !allowed.includes(origin))).toEqual([]);
  // The text font is the site's own Inter.
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('600 16px "Inter"')))
    .toBe(true);
});

test("legal notice: loaded on demand, with the publisher and the host", async ({ page }) => {
  const legalRequests: string[] = [];
  page.on("request", (request) => {
    if (/LegalNoticePage/.test(request.url())) legalRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator(".use-case-card").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(legalRequests).toHaveLength(0);

  await page.locator(".app-nav").getByRole("link", { name: /mentions légales|legal notice/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/mentions légales|legal notice/i);
  expect(legalRequests.length).toBeGreaterThan(0);
  await expect(page.getByText(/923 875 744/).first()).toBeVisible();
  await expect(page.getByText(/Infomaniak Network SA/)).toBeVisible();
});
