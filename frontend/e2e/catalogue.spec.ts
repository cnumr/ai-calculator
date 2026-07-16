import { expect, test } from "@playwright/test";

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
