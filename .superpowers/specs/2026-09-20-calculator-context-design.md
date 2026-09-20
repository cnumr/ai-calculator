# Calculator Results And Use-Case Context

## Scope

Deliver two independent increments: result-context improvements first, followed by contextual information in use-case cards. The calculator keeps EcoLogits as the sole source of computed impacts.

## Increment 1: Results And Context

### Individual result

The results sidebar starts with a primary annual GHG card for one user. It shows a localized central value, its min-max range, an explicit `218 working days per year` note, and the `GHG` criterion label. The five existing impact criteria remain available immediately below in the detailed grid.

Existing CO2 equivalences are grouped beneath the primary GHG result. Every equivalence includes text, a value, and a unit.

### Provider breakdown

Each provider row shows its localized name, annual GHG amount, and percentage of the total. A visual share bar supplements but never replaces the numeric percentage and amount. Zero totals produce no invalid percentage or bar.

### Enterprise result

The enterprise section presents its annual GHG result before its detailed five-criterion grid. It reuses the same value-range and equivalence conventions as the individual result.

### Reset

A labelled reset control restores the catalogue defaults: selected providers, card provider/profile/frequency values, and headcount. No persistence or new network request is added.

## Increment 2: Use-Case Context

### Catalogue content

The YAML catalogue receives localized display metadata for each use case: a short subtitle and a brief explanatory hint. Each profile receives a localized explanation of its intended use. This metadata contains no impact value and does not alter EcoLogits inputs or static image/video impacts.

### Card presentation

Cards retain the approved single-surface two-column layout: form on the left, primary GHG and water impacts on the right, and the existing full-width detail toggle below. The subtitle appears under the use-case title. The selected profile explanation appears near its selector. Primary impacts retain their existing informative SVG icons and adaptive units.

## Accessibility And Sobriety

- All form fields retain visible associated labels.
- GHG, provider share, equivalences, and status information are conveyed in text; colour and bars are supplementary.
- The reset control has an explicit localized accessible name.
- No automatic animation, image, font, new dependency, or additional API request is introduced.
- The visual structure preserves a logical DOM and keyboard order on desktop and mobile.

## Verification

- Unit tests cover central values, range display, 218-day copy, zero-share handling, and reset state.
- API tests cover contextual metadata serialization.
- Component tests cover localized subtitle and profile hint rendering.
- E2E tests cover reset and provider breakdown values.
