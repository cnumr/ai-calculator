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

test("lists use cases as compact rows grouped by family, settings on demand", async ({
  page,
}) => {
  await page.goto("/");

  // One heading per family, in the catalogue order.
  const families = page.locator(".use-case-family__title");
  await expect(families).toHaveText([
    /rédaction|writing/i,
    /analyse|analysis/i,
    /bureautique|office/i,
    /visuelle|visual/i,
    /développement|development/i,
  ]);

  // Frequency and results on the row, vertically centred together.
  const card = page.locator(".use-case-card").first();
  const frequency = card.getByLabel(/^(fréquence moyenne|average frequency)$/i);
  const results = card.locator(".use-case-card__summary");
  const [frequencyBox, resultsBox] = await Promise.all(
    [frequency, results].map((l) => l.boundingBox()),
  );
  const middle = (box: { y: number; height: number } | null) => box!.y + box!.height / 2;
  expect(Math.abs(middle(resultsBox) - middle(frequencyBox))).toBeLessThan(8);
  expect(resultsBox!.x).toBeGreaterThan(frequencyBox!.x);
  // The column titles sit right above the frequency and the results.
  // (The first cell holds the "Only my usages" filter.)
  const titles = page.locator(".use-case-catalog__columns > span");
  const [frequencyTitle, impactTitle] = await Promise.all(
    [titles.nth(0), titles.nth(1)].map((l) => l.boundingBox()),
  );
  const frequencyCell = await card.locator(".use-case-card__frequency").boundingBox();
  expect(Math.abs(frequencyTitle!.x - frequencyCell!.x)).toBeLessThan(2);
  expect(Math.abs(impactTitle!.x - resultsBox!.x)).toBeLessThan(2);
  // A compact row: well under the former ~340 px card.
  expect((await card.boundingBox())!.height).toBeLessThan(100);

  // Provider and profile appear once the settings are opened.
  await expect(card.getByLabel(/fournisseur|provider/i)).toHaveCount(0);
  await card.getByRole("button", { name: /réglages|settings/i }).click();
  await expect(card.getByLabel(/fournisseur|provider/i)).toBeVisible();
  await expect(card.getByLabel(/profil|profile/i)).toBeVisible();
});

test("calculator: impacts come from POST /api/calculate and follow the cards", async ({
  page,
}) => {
  const firstCalculation = page.waitForResponse(
    (r) => r.url().endsWith("/api/calculate") && r.request().method() === "POST",
  );
  await page.goto("/");
  expect((await firstCalculation).ok()).toBe(true);

  const videoCard = page.locator(".use-case-card", {
    has: page.getByRole("heading", { name: /génération de vidéos|video generation/i }),
  });
  await expect(videoCard).toBeVisible();
  const openaiChip = page.getByRole("button", { name: /openai/i });
  await expect(openaiChip).toHaveAttribute("aria-pressed", "true");

  const individualTotal = page.locator(".gwp-summary__value").first();
  await expect(individualTotal).not.toHaveText("");
  const before = await individualTotal.textContent();

  // Changing the frequency triggers a new calculation and new totals.
  const recalculation = page.waitForResponse(
    (r) => r.url().endsWith("/api/calculate") && r.request().method() === "POST",
  );
  await videoCard.getByLabel(/^(fréquence moyenne|average frequency)$/i).fill("5");
  const request = (await recalculation).request().postDataJSON();
  const video = request.usages.find((u: { use_case_id: string }) => u.use_case_id === "video");
  expect(video.frequency).toBe(5);
  expect(video.frequency_unit).toBe("day");
  await expect(individualTotal).not.toHaveText(before!);

  // The impact details are in the settings panel.
  await videoCard.getByRole("button", { name: /réglages|settings/i }).click();
  await expect(videoCard.locator(".use-case-card__impacts .range-gauge")).toHaveCount(5);

  const anthropicChip = page.getByRole("button", { name: /anthropic/i });
  // Every provider is selected by default: a click deselects it.
  await expect(anthropicChip).toHaveAttribute("aria-pressed", "true");
  await anthropicChip.click();
  await expect(anthropicChip).toHaveAttribute("aria-pressed", "false");
});
