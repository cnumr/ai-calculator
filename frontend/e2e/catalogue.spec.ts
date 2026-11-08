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

test("puts provider, profile and frequency on one row, with results below", async ({
  page,
}) => {
  await page.goto("/");

  const card = page.locator(".use-case-card").first();
  await expect(card).toBeVisible();
  const provider = card.getByLabel(/fournisseur|provider/i);
  const profile = card.getByLabel(/profil|profile/i);
  const frequency = card.getByLabel(/fréquence|frequency/i);
  const selects = card.locator(".use-case-card__selects");
  const results = card.locator(".use-case-card__results");

  const [providerBox, profileBox, frequencyBox, selectsBox, resultsBox] =
    await Promise.all(
      [provider, profile, frequency, selects, results].map((l) => l.boundingBox()),
    );

  // Same line (vertically centred together), left to right.
  const middle = (box: { y: number; height: number } | null) => box!.y + box!.height / 2;
  expect(Math.abs(middle(profileBox) - middle(providerBox))).toBeLessThan(3);
  expect(Math.abs(middle(frequencyBox) - middle(providerBox))).toBeLessThan(3);
  expect(profileBox!.x).toBeGreaterThan(providerBox!.x);
  expect(frequencyBox!.x).toBeGreaterThan(profileBox!.x);
  // Results below the selection row, as wide as it.
  expect(resultsBox!.y).toBeGreaterThan(selectsBox!.y + selectsBox!.height);
  expect(Math.abs(resultsBox!.width - selectsBox!.width)).toBeLessThan(2);
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
