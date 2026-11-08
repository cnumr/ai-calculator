import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18next from "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";

afterEach(async () => {
  await i18next.changeLanguage("en");
});

describe("Co2Equivalents", () => {
  it("renders one equivalence line per entry in the local dataset", async () => {
    await i18next.changeLanguage("en");
    render(<Co2Equivalents gwpKgCo2eq={2.18} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // ImpactCO2 factors: 0.0640 kg/h streaming, 80.2 kg/smartphone,
    // 0.142 kg/km thermal car -> 34 h, 0 smartphones, 15 km.
    expect(screen.getByText("34 hours of video streaming")).toBeInTheDocument();
    expect(screen.getByText("0 smartphones")).toBeInTheDocument();
    expect(screen.getByText("15 km by car")).toBeInTheDocument();
  });

  it("formats and pluralises counts in French", async () => {
    await i18next.changeLanguage("fr");
    // 100 kg -> 1 562 h streaming, 1 smartphone, 703 km.
    render(<Co2Equivalents gwpKgCo2eq={100} />);

    const lines = screen.getAllByRole("listitem").map((li) => li.textContent);
    // French groups thousands with a narrow no-break space (U+202F).
    expect(lines).toEqual([
      "1\u202f562 heures de streaming vidéo",
      "1 smartphone",
      "703 km en voiture",
    ]);
  });

  it("links to the ImpactCO2 comparator with the dataset slugs and language", async () => {
    await i18next.changeLanguage("fr");
    render(<Co2Equivalents gwpKgCo2eq={12.345} />);

    const link = screen.getByRole("link", { name: /impactco2/i });
    expect(link).toHaveAttribute(
      "href",
      "https://impactco2.fr/outils/comparateur?value=12.35&comparisons=streamingvideo,smartphone,voiturethermique&language=fr",
    );
  });
});
