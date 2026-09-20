# Use-case defaults alignment

## Goal

Make the initial selections and annual extrapolation consistent with the published calculator while retaining EcoLogits as the source of impact calculations.

## Data contract

The use-case API will expose the existing YAML fields `default_provider` and `recommended_tier` for every use case. The frontend API client will map them to `defaultProviderId` and `recommendedProfileId`.

## Initialization

When the catalogue loads, each card selects its API-provided default provider and profile. If a catalogue response omits either default or does not contain the referenced provider/profile, the frontend uses its existing first-available fallback.

## Annualization

The frontend uses 218 working days per year, matching the published calculator.

## Constraints

- Text impact values continue to be calculated by EcoLogits; legacy hard-coded POC values are not added.
- Image and video static impacts are unchanged.
- No new request, dependency, interactive control, or visual change is added.
- Existing accessible labels and form behavior remain unchanged.

## Verification

- Backend API tests assert default provider and profile fields.
- Frontend tests assert initial card state follows API defaults.
- Aggregate tests assert annual values use 218 working days.
