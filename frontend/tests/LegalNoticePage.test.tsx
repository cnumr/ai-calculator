import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../src/i18n";
import LegalNoticePage from "../src/pages/LegalNoticePage";

function renderPage() {
  render(
    <MemoryRouter>
      <LegalNoticePage />
    </MemoryRouter>,
  );
}

const section = (name: RegExp) => screen.getByRole("region", { name });

beforeEach(async () => {
  await i18n.changeLanguage("fr");
});

describe("LegalNoticePage", () => {
  it("names the publisher, its identifiers and the publication director", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Mentions légales" })).toBeInTheDocument();
    const publisher = section(/^éditeur$/i);
    expect(publisher).toHaveTextContent("Association Green IT – association loi 1901");
    expect(publisher).toHaveTextContent("SIREN : 923 875 744");
    expect(publisher).toHaveTextContent("N° RNA : W595 040 531");
    expect(publisher).toHaveTextContent("SIRET 923 875 744 00032");
    expect(publisher).toHaveTextContent("7 rue Pierre Brossolette, 94130 Nogent-sur-Marne");
    expect(publisher).toHaveTextContent("06 16 19 22 73");
    expect(publisher).toHaveTextContent("Directeur de la publication : Renaud Héluin");
    expect(
      within(publisher).getByRole("link", { name: "formulaire de contact de l'association" }),
    ).toHaveAttribute("href", "https://greenit.eco/contact/");
  });

  it("names the host with its address", () => {
    renderPage();

    const host = section(/^hébergement$/i);
    expect(host).toHaveTextContent(
      "Infomaniak Network SA, Rue Eugène-Marziano 25, 1227 Les Acacias (GE), Suisse",
    );
    expect(within(host).getByRole("link", { name: "www.infomaniak.com" })).toHaveAttribute(
      "href",
      "https://www.infomaniak.com/",
    );
  });

  it("covers reuse, results, personal data, links and contact", () => {
    renderPage();

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Éditeur",
      "Hébergement",
      "Conception et code source",
      "Propriété intellectuelle et réutilisation",
      "Portée des résultats",
      "Données personnelles",
      "Liens externes",
      "Nous contacter",
    ]);
    const privacy = section(/^données personnelles$/i);
    expect(privacy).toHaveTextContent("aucun cookie");
    expect(privacy).toHaveTextContent("ne contacte aucun service tiers");
    expect(within(privacy).getByRole("link", { name: "CNIL" })).toHaveAttribute(
      "href",
      "https://www.cnil.fr/",
    );
    // Site pages open in the app, without reloading.
    expect(
      within(section(/^portée des résultats$/i)).getByRole("link", { name: "méthodologie" }),
    ).toHaveAttribute("href", "/methodologie");
    expect(
      within(section(/^nous contacter$/i)).getByRole("link", { name: /issues du projet/i }),
    ).toHaveAttribute("href", "https://github.com/cnumr/ai-calculator/issues");
  });

  it("speaks English too", async () => {
    await i18n.changeLanguage("en");
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Legal notice" })).toBeInTheDocument();
    expect(section(/^publisher$/i)).toHaveTextContent("Publication director: Renaud Héluin");
    expect(section(/^hosting$/i)).toHaveTextContent("1227 Les Acacias (GE), Switzerland");
  });
});
