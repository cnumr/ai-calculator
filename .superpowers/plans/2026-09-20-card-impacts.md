# Card Impact Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display one immediately visible midpoint value for greenhouse-gas emissions and water on every supported use-case card.

**Architecture:** Keep the catalog API and impact ranges unchanged. `UseCaseCard` will scale its already-loaded profile impacts by the selected frequency, derive the midpoint of GHG and water ranges, then format the result through the existing unit utilities. The existing expandable range gauges remain untouched.

**Tech Stack:** React 19, TypeScript, react-i18next, Vitest, Testing Library.

## Global Constraints

- Keep EcoLogits at version `0.11.1`, the latest PyPI release at design time.
- Do not alter the content or behavior of the existing expandable detail ranges.
- Display the midpoint `(min + max) / 2` after daily-frequency scaling, using the same adaptive unit formatting as the detailed ranges.
- Support French and English labels.
- Do not add API calls, dependencies, interactive controls, or assets.
- Preserve semantic static content and the responsive card layout.

---

### Task 1: Render Compact GHG And Water Summaries

**Files:**
- Modify: `frontend/tests/UseCaseCard.test.tsx:17-218`
- Modify: `frontend/src/components/UseCaseCard.tsx:1-199`
- Modify: `frontend/src/i18n/fr.json:42-77`
- Modify: `frontend/src/i18n/en.json:42-77`
- Modify: `frontend/src/index.css:469-579`

**Interfaces:**
- Consumes: `scaleImpacts(impacts: Impacts, factor: number): Impacts` from `frontend/src/domain/aggregate.ts`.
- Consumes: `scaleRange(min: number, max: number, baseUnit: string): { min: number; max: number; unit: string }` and `formatNumber(value: number): string` from `frontend/src/domain/units.ts`.
- Produces: static `use-case-card__summary` content that renders the scaled midpoint or the existing unavailable message for GHG and water.

- [ ] **Step 1: Write the failing tests**

Extend the `EMAIL` fixture so that its `eco` profile contains `water: { min: 1, max: 2 }`. Move the existing `VIDEO` fixture from the null-criteria test to module scope so both tests can use it. Add these tests to `frontend/tests/UseCaseCard.test.tsx`:

```tsx
it("shows scaled midpoint GHG and water values without opening details", () => {
  render(
    <UseCaseCard
      useCase={EMAIL}
      availableProviderIds={["openai", "anthropic"]}
      providerId="openai"
      profileId="eco"
      frequencyPerDay={2}
      onChange={() => {}}
      onImpactsChange={() => {}}
    />,
  );

  expect(screen.getByText(/greenhouse gases|gaz à effet de serre/i)).toHaveTextContent(
    /3\.00 kgCO2eq/,
  );
  expect(screen.getByText(/water|eau/i)).toHaveTextContent(/3\.00 L/);
  expect(
    screen
      .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
      .closest("details"),
  ).not.toHaveAttribute("open");
});

it("shows unavailable when a card summary metric is null", () => {
  render(
    <UseCaseCard
      useCase={VIDEO}
      availableProviderIds={["google"]}
      providerId="google"
      profileId="video"
      frequencyPerDay={1}
      onChange={() => {}}
      onImpactsChange={() => {}}
    />,
  );

  expect(screen.getByText(/water|eau/i)).toHaveTextContent(
    /not available|non disponible/i,
  );
});
```

- [ ] **Step 2: Run the targeted test file to verify it fails**

Run: `npm test -- tests/UseCaseCard.test.tsx`

Expected: FAIL because the closed card does not render GHG or water midpoint summaries.

- [ ] **Step 3: Add the localized labels and minimal card markup**

Add `cardImpactSummary` keys under `calculator` in both locale files:

```json
// fr.json
"cardImpactSummary": {
  "gwp": "Gaz à effet de serre",
  "water": "Eau"
}

// en.json
"cardImpactSummary": {
  "gwp": "Greenhouse gases",
  "water": "Water"
}
```

In `UseCaseCard.tsx`, import `formatNumber` and `scaleRange`, derive the scaled impacts once when `currentProfile` exists, then render the summary before the existing `<details>` block:

```tsx
const scaledImpacts = currentProfile
  ? scaleImpacts(currentProfile.impacts, frequencyPerDay)
  : null;

const summaryCriteria: Array<{ key: "gwp" | "water"; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "water", unit: "L" },
];

{scaledImpacts && (
  <dl className="use-case-card__summary">
    {summaryCriteria.map(({ key, unit }) => {
      const range = scaledImpacts[key];
      const value = range && scaleRange(range.min, range.max, unit);
      return (
        <div key={key}>
          <dt>{t(`calculator.cardImpactSummary.${key}`)}</dt>
          <dd>
            {value
              ? `${formatNumber((value.min + value.max) / 2)} ${value.unit}`
              : t("calculator.notAvailable")}
          </dd>
        </div>
      );
    })}
  </dl>
)}
```

Keep the existing IIFE and `RangeGauge` loop in `<details>` unchanged except for reusing `scaledImpacts` rather than recalculating it.

- [ ] **Step 4: Style the static summary responsively**

Append concise styles near the existing card detail rules:

```css
.use-case-card__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.use-case-card__summary div {
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
}

.use-case-card__summary dt {
  color: var(--ink-soft);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.use-case-card__summary dd {
  margin: 0.25rem 0 0;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

@media (max-width: 360px) {
  .use-case-card__summary {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run focused checks**

Run: `npm test -- tests/UseCaseCard.test.tsx && npm run build`

Expected: the focused card tests pass and TypeScript/Vite production build succeeds.

- [ ] **Step 6: Run all frontend tests**

Run: `npm test`

Expected: all frontend test files pass with no new failures.

- [ ] **Step 7: Commit the task**

```bash
git add frontend/tests/UseCaseCard.test.tsx frontend/src/components/UseCaseCard.tsx frontend/src/i18n/fr.json frontend/src/i18n/en.json frontend/src/index.css
git commit -m "feat(calculator): show card impact summaries"
```

## Self-Review

- Spec coverage: Task 1 covers visible GHG and water midpoint values, selected-frequency scaling, unavailable metrics, unchanged expandable ranges, bilingual copy, static semantic markup, responsive layout, and no extra API calls or dependencies.
- Placeholder scan: no incomplete implementation instructions or undefined interfaces remain.
- Type consistency: `scaledImpacts` is typed as `Impacts | null`; only the GHG and water keys are used in the summary; both utility function signatures match their current source definitions.
