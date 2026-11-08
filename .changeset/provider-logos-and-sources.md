---
"ai-calculator": minor
---

Rework the use-case cards: one selection row, results below, sources and editable assumptions.

- **One selection row**: provider (with its logo), profile and average daily frequency sit side by side.
- **Results below**: GHG and water side by side, with the methodological source in small print on the right: "Source: EcoLogits 0.11.3, LLM inference model" (or video generation model), linking to the EcoLogits methodology; image generation keeps its "indicative value, no published source yet" note. `GET /api/use-cases` exposes a `source` per use case (`id`, `version` read from the installed EcoLogits, `url`).
- **Editable token assumption**: text use cases now offer a "Customize" menu, like video, showing the generated tokens per action (catalogue value as the default) and letting users change it. The "calculation assumption" line is removed. `POST /api/calculate` accepts `parameters.output_tokens` (1 to 10,000,000) for text usages; parameters in the catalogue are either a choice among `options` or a free integer in `[min, max]`, and profiles no longer expose `output_tokens` directly.
- **Provider logos** also appear next to each provider in the breakdown by provider.
