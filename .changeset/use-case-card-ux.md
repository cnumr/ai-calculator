---
"ai-calculator": minor
---

Rework the use-case cards for readability.

- **Wider layout**: the site content now uses up to 1280 px (was 960 px).
- **Models shown**: each profile names its model, e.g. "Eco (GPT-4o mini)". The catalogue gains a `model_labels` table and `GET /api/use-cases` exposes `models` on each profile.
- **Compact card**: the average daily frequency sits at the top right, with a visible label ("1 /day"), provider and profile share one row, and the GHG and water values sit beside them.
- **Calculation assumption**: text profiles state the generated tokens assumed per action ("Calculation assumption: 300 tokens generated per action"), replacing the generic profile hints; `GET /api/use-cases` exposes `output_tokens`.
- **Customize menu**: model-specific parameters (video resolution, duration, audio) are folded into a "Customize" menu whose summary recalls the current values.
- **Label**: the "Deep research" profile is now "Research", the model name already saying so.
