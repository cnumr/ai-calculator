# Card impact summaries

## Scope

Each use-case card will show a compact, always-visible summary for greenhouse-gas emissions and water consumption. The summary supplements, rather than replaces, the existing expandable details.

EcoLogits remains at version 0.11.1 because this is the latest PyPI release.

## Display

- Show GHG and water after the frequency field on every supported use-case card.
- Calculate each displayed value as the midpoint of its existing minimum and maximum bounds, after scaling by the selected daily frequency.
- Use the same adaptive units as the existing detailed ranges: `kgCO2eq` may be displayed as `gCO2eq` or `mgCO2eq`, and `L` may be displayed as `mL` or `m³`.
- When a value is unavailable, display the existing localized unavailable message for that metric.
- Add localized French and English labels.

## Compatibility

- The expandable detail section remains unchanged: it continues to contain all five indicators and their min/max ranges.
- Existing card selection, profile selection, frequency handling, and aggregate calculations remain unchanged.

## Accessibility And Sobriety

- Use static semantic text instead of an additional interactive control.
- Keep the summary concise and update it from data already loaded by the card, without API calls or additional assets.
- Retain sufficient visual contrast and preserve the existing responsive card layout.

## Tests

- Verify the midpoint GHG and water values are shown immediately.
- Verify values use the selected frequency.
- Verify unavailable metrics show the localized unavailable text.
- Preserve the existing test that confirms detailed ranges are hidden until expanded.
