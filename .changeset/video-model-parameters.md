---
"ai-calculator": minor
---

Let users set model-specific parameters on the video use case.

- **Parameters**: resolution, duration and audio, with options taken from each model's EcoLogits capabilities (no 4K: no EcoLogits model supports it).
- **Models**: Google "Standard" (Veo 3.0) and "Fast" (Veo 3.0 Fast) profiles, plus OpenAI (Sora 2 Pro).
- **Precomputed**: every combination is computed at startup and served by `GET /api/use-cases` (`parameters` and `variants` on each profile); changing a setting needs no extra request.
- **Validation**: unknown models and unsupported default values in `use_cases.yaml` stop the backend at startup.
