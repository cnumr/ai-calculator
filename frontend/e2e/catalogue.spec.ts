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

test("uses a two-column layout with full-width use-case card details", async ({
  page,
}) => {
  await page.goto("/");

  const card = page.locator(".use-case-card").first();
  await expect(card).toBeVisible();
  const form = card.locator(".use-case-card__form");
  const impacts = card.locator(".use-case-card__primary-impacts");
  const details = card.locator(".use-case-card__details");

  await expect(form).toBeVisible();
  await expect(impacts).toBeVisible();
  const formBox = await form.boundingBox();
  const impactsBox = await impacts.boundingBox();
  const detailsBox = await details.boundingBox();

  expect(formBox).not.toBeNull();
  expect(impactsBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(impactsBox!.x).toBeGreaterThan(formBox!.x);
  expect(Math.abs(impactsBox!.y - formBox!.y)).toBeLessThan(1);
  expect(detailsBox!.y).toBeGreaterThan(formBox!.y + formBox!.height);
  expect(detailsBox!.width).toBeGreaterThan(formBox!.width);
});

test("catalogue-driven calculator: load, toggle provider, change profile, verify totals update", async ({
  page,
}) => {
  await page.goto("/");

  const firstCard = page.locator(".use-case-card").first();
  await expect(firstCard).toBeVisible();

  const openaiChip = page.getByRole("button", { name: /openai/i });
  await expect(openaiChip).toHaveAttribute("aria-pressed", "true");

  const individualBefore = await page
    .locator(".impacts-grid")
    .first()
    .textContent();

  const profileSelect = firstCard.getByLabel(/profil|profile/i);
  const profileOptionCount = await profileSelect.locator("option").count();
  if (profileOptionCount > 1) {
    await profileSelect.selectOption({ index: 1 });
  }

  // The first card may only offer a single profile, so also vary frequency
  // to guarantee a deterministic, observable change to the annual totals.
  const frequencyInput = firstCard.getByLabel(/fréquence|frequency/i);
  await frequencyInput.fill("5");

  await firstCard
    .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
    .click();
  await expect(firstCard.locator("details")).toHaveAttribute("open", "");

  const individualAfter = await page
    .locator(".impacts-grid")
    .first()
    .textContent();

  const anthropicChip = page.getByRole("button", { name: /anthropic/i });
  await anthropicChip.click();
  await expect(anthropicChip).toHaveAttribute("aria-pressed", "true");

  expect(individualBefore).not.toEqual(individualAfter);
});
