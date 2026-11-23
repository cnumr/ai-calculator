import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../src/i18n";
import MethodologyPage from "../src/pages/MethodologyPage";

describe("MethodologyPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    void i18n.changeLanguage("en");
  });

  it("describes how images are transposed from the reference video", async () => {
    await i18n.changeLanguage("fr");
    render(
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>,
    );

    const section = screen.getByRole("region", { name: "Génération d'images" });
    expect(section).toHaveAttribute("id", "images");
    const sizes = within(section).getAllByRole("row").slice(1).map((row) => row.firstChild?.textContent);
    expect(sizes).toEqual(["512 × 512", "1024 × 1024", "2048 × 2048"]);
    expect(within(section).getByText(/44,1 Wh \(27,7 à 60,6 Wh\)/)).toBeInTheDocument();
    const factors = within(section).getAllByRole("listitem").map((item) => item.textContent);
    expect(factors[0]).toMatch(/^1024 × 1024 : facteur d'impact 30 fois inférieur/);
    expect(factors[1]).toMatch(/^2048 × 2048 : facteur d'impact 8 fois inférieur/);
    expect(screen.getByRole("link", { name: /arXiv 2506.17016/ })).toHaveAttribute(
      "href",
      "https://arxiv.org/abs/2506.17016",
    );
  });

  it("sums up the output tokens and impact factor source of each use case", async () => {
    await i18n.changeLanguage("fr");
    render(
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>,
    );

    const section = screen.getByRole("region", {
      name: "Synthèse des cas d'usage et facteurs d'impact associés",
    });
    const rows = within(section).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(15);
    const cells = (name: string) =>
      within(rows.find((row) => row.textContent?.includes(name))!)
        .getAllByRole("cell")
        .map((cell) => cell.textContent?.replace(/\s/g, " "));
    expect(cells("Synthèse d'environ 2 pages")).toEqual([
      "Synthèse d'environ 2 pages",
      "2 000",
      "1 500 à 3 000",
      "EcoLogits, nombre de tokens personnalisé (40 % du rapport de 5 pages)",
    ]);
    expect(cells("2048 × 2048")).toEqual([
      "2048 × 2048",
      "—",
      "—",
      "Vidéo 720p ÷ 8, sur la base de Veo 3.1",
    ]);
  });

  it("explains how a weekly or monthly frequency is converted", async () => {
    await i18n.changeLanguage("fr");
    render(
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>,
    );

    const section = screen.getByRole("region", { name: "Fréquence d'usage" });
    expect(section).toHaveAttribute("id", "frequence");
    const rows = within(section).getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows).toEqual([
      "Par jour218 jours ouvrésn",
      "Par semaine43,6 semaines (218 ÷ 5 jours ouvrés)n ÷ 5",
      "Par mois11 mois (un mois de congés)n × 11 ÷ 218",
    ]);
  });

  it("scrolls to the section named in the URL", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <MemoryRouter initialEntries={["/methodologie#images"]}>
        <MethodologyPage />
      </MemoryRouter>,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
