---
"ai-calculator": minor
---

Remove the legacy `POST /api/calculate` endpoint and its duplicate extrapolation logic: the calculator aggregates impacts on the frontend from `GET /api/use-cases`.
