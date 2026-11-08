---
"ai-calculator": minor
---

Move the calculator's business logic to the backend: `POST /api/calculate`.

- **One scenario endpoint**: it receives every daily usage and the headcount, and returns the impacts of each usage (per action, per day, per year), the individual and company annual totals, the breakdown by provider and the CO2 equivalents.
- **Typed parameters per use-case kind**: usages are discriminated on `kind` (`text`, `video`, `image`); only video usages accept `resolution`, `duration_s` and `with_audio`, each checked against the model's options. Invalid scenarios get a `422` with an explicit message.
- **No more precomputed impacts**: `GET /api/use-cases` only describes the choices (catalogue down from 59 to 11.5 KB) and declares each use case's `kind`; EcoLogits impacts are computed on demand and cached.
- **CO2 equivalents** (ImpactCO2 factors) now live in the backend.
- **Frontend**: it builds the scenario, sends it 150 ms after the last change, cancels outdated requests and only applies the latest answer. Values awaiting an update are dimmed, and a failed calculation keeps the last result and offers a retry. Results are unchanged.
