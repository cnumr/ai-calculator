import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18next from "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";
import type { Co2EquivalentQuantity } from "../src/api/client";

afterEach(async () => {
  await i18next.changeLanguage("en");
});

// Quantities as computed by the backend.
const equivalents = (streaming: number, smartphones: number, km: number): Co2EquivalentQuantity[] => [
  { id: "streaming_hour", impactCo2Slug: "streamingvideo", quantity: streaming },
  { id: "smartphone", impactCo2Slug: "smartphone", quantity: smartphones },
  { id: "car_km", impactCo2Slug: "voiturethermique", quantity: km },
];

describe("Co2Equivalents", () => {
  it("rounds and pluralises the quantities it receives", async () => {
    await i18next.changeLanguage("en");
    render(<Co2Equivalents equivalents={equivalents(34.05, 0.03, 15.3)} gwpKgCo2eq={2.18} />);

    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "34 hours of video streaming",
      "0 smartphones",
      "15 km by car",
    ]);
  });

  it("formats and pluralises counts in French", async () => {
    await i18next.changeLanguage("fr");
    render(<Co2Equivalents equivalents={equivalents(1562.09, 1.25, 702.97)} gwpKgCo2eq={100} />);

    // French groups thousands with a narrow no-break space (U+202F).
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1 562 heures de streaming vidéo",
      "1 smartphone",
      "703 km en voiture",
    ]);
  });

  it("links to the ImpactCO2 comparator with the slugs and language", async () => {
    await i18next.changeLanguage("fr");
    render(<Co2Equivalents equivalents={equivalents(1, 1, 1)} gwpKgCo2eq={12.345} />);

    expect(screen.getByRole("link", { name: /impactco2/i })).toHaveAttribute(
      "href",
      "https://impactco2.fr/outils/comparateur?value=12.35&comparisons=streamingvideo,smartphone,voiturethermique&language=fr",
    );
  });
});
