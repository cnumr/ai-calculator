import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../src/i18n";
import { MethodologyPage } from "../src/pages/MethodologyPage";

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
    expect(screen.getByText(/Veo 3.1 \(Google\), 720p, 8 secondes/)).toBeInTheDocument();
    const rows = within(section).getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows).toEqual([
      "1024 × 1024vidéo de référence ÷ 30environ 1,5 Wh",
      "2048 × 2048vidéo de référence ÷ 8environ 5 Wh",
    ]);
    expect(screen.getByRole("link", { name: /arXiv 2506.17016/ })).toHaveAttribute(
      "href",
      "https://arxiv.org/abs/2506.17016",
    );
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
