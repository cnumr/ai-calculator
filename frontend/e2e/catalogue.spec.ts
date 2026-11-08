import { expect, test } from "@playwright/test";

test("shows use-case cards in a single column", async ({ page }) => {
  await page.goto("/");

  const cards = page.locator(".use-case-card");
  await expect(cards.first()).toBeVisible();
  const firstCard = await cards.nth(0).boundingBox();
  const secondCard = await cards.nth(1).boundingBox();

  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();
  expect(secondCard!.x).toBe(firstCard!.x);
  expect(secondCard!.y).toBeGreaterThan(firstCard!.y);
});

test("puts the selectors and impacts on one row, with full-width details", async ({
  page,
}) => {
  await page.goto("/");

  const card = page.locator(".use-case-card").first();
  await expect(card).toBeVisible();
  const selection = card.locator(".use-case-card__selection");
  const impacts = card.locator(".use-case-card__primary-impacts");
  const details = card.locator(".use-case-card__details").last();

  await expect(selection).toBeVisible();
  await expect(impacts).toBeVisible();
  const selectionBox = await selection.boundingBox();
  const impactsBox = await impacts.boundingBox();
  const detailsBox = await details.boundingBox();

  expect(selectionBox).not.toBeNull();
  expect(impactsBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(impactsBox!.x).toBeGreaterThan(selectionBox!.x);
  expect(Math.abs(impactsBox!.y - selectionBox!.y)).toBeLessThan(1);
  expect(detailsBox!.y).toBeGreaterThan(selectionBox!.y + selectionBox!.height);
  expect(detailsBox!.width).toBeGreaterThan(selectionBox!.width);
});

test("calculator: impacts come from POST /api/calculate and follow the cards", async ({
  page,
}) => {
  const firstCalculation = page.waitForResponse(
    (r) => r.url().endsWith("/api/calculate") && r.request().method() === "POST",
  );
  await page.goto("/");
  expect((await firstCalculation).ok()).toBe(true);

  const firstCard = page.locator(".use-case-card").first();
  await expect(firstCard).toBeVisible();
  const openaiChip = page.getByRole("button", { name: /openai/i });
  await expect(openaiChip).toHaveAttribute("aria-pressed", "true");

  const individualTotal = page.locator(".gwp-summary__value").first();
  await expect(individualTotal).not.toHaveText("");
  const before = await individualTotal.textContent();

  // Changing the frequency triggers a new calculation and new totals.
  const recalculation = page.waitForResponse(
    (r) => r.url().endsWith("/api/calculate") && r.request().method() === "POST",
  );
  await firstCard.getByLabel(/fréquence|frequency/i).fill("5");
  const request = (await recalculation).request().postDataJSON();
  expect(request.usages[0].frequency_per_day).toBe(5);
  await expect(individualTotal).not.toHaveText(before!);

  const impactDetails = firstCard.locator(".use-case-card__details").last();
  await impactDetails
    .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
    .click();
  await expect(impactDetails).toHaveAttribute("open", "");

  const anthropicChip = page.getByRole("button", { name: /anthropic/i });
  await anthropicChip.click();
  await expect(anthropicChip).toHaveAttribute("aria-pressed", "true");
});
