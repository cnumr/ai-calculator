import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../src/i18n";
import AboutPage from "../src/pages/AboutPage";

describe("AboutPage", () => {
  afterEach(() => {
    void i18n.changeLanguage("en");
  });

  it("credits the contributors and the Claude Code use, with its impacts", async () => {
    await i18n.changeLanguage("fr");
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Conception et réalisation :")).toBeInTheDocument();
    expect(screen.getByText("Tests et relectures internes :")).toBeInTheDocument();
    expect(screen.getByText("Frédéric Bordage")).toBeInTheDocument();

    const section = screen.getByRole("region", { name: "Réalisé avec l'aide de Claude Code" });
    expect(within(section).getByText(/a généré 1\s210\s189 tokens/)).toBeInTheDocument();
    expect(within(section).getByText(/^Gaz à effet de serre : 1,31 à 2,49 kg CO2eq$/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "limites de la méthodologie" })).toHaveAttribute(
      "href",
      "/methodologie#limites",
    );
  });
});
