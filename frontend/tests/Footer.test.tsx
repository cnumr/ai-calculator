import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18next from "../src/i18n";
import { Footer } from "../src/components/Footer";
import * as apiClient from "../src/api/client";
import packageJson from "../package.json";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchUseCases: vi.fn() };
});

const mockedFetchUseCases = vi.mocked(apiClient.fetchUseCases);

const CATALOG: apiClient.UseCasesCatalog = {
  providers: [],
  useCases: [],
  dataSources: [
    { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrievedOn: null, url: "https://ecologits.ai/" },
    { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrievedOn: "2026-11-08", url: "https://impactco2.fr/" },
  ],
};

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

afterEach(async () => {
  await i18next.changeLanguage("en");
});

describe("Footer", () => {
  it("shows the site version from package.json", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);
    renderFooter();

    expect(screen.getByRole("contentinfo")).toHaveTextContent(`AI Calculator · v${packageJson.version}`);
  });

  it("links to GreenIT.fr and to the GitHub repository, in a new tab", async () => {
    await i18next.changeLanguage("fr");
    mockedFetchUseCases.mockResolvedValue(CATALOG);
    renderFooter();

    const greenit = screen.getByRole("link", { name: /Association GreenIT\.fr/ });
    expect(greenit).toHaveAttribute("href", "https://www.greenit.fr/");
    expect(greenit).toHaveAttribute("target", "_blank");
    expect(greenit).toHaveAccessibleName("Association GreenIT.fr (nouvel onglet)");
    expect(screen.getByRole("link", { name: /Code source sur GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/cnumr/ai-calculator",
    );
  });

  it("lists the data sources with their version or retrieval date", async () => {
    await i18next.changeLanguage("fr");
    mockedFetchUseCases.mockResolvedValue(CATALOG);
    renderFooter();

    const sources = await waitFor(() => {
      const element = document.querySelector(".app-footer__sources");
      expect(element).not.toBeNull();
      return element!;
    });
    expect(sources).toHaveTextContent(
      "Sources de données : EcoLogits ↗ 0.11.3 · ImpactCO2 (ADEME) ↗, relevé du 8 nov. 2026",
    );
    expect(within(sources as HTMLElement).getByRole("link", { name: /EcoLogits/ })).toHaveAttribute(
      "href",
      "https://ecologits.ai/",
    );
  });

  it("omits the sources when the catalogue cannot be loaded", async () => {
    mockedFetchUseCases.mockRejectedValue(new apiClient.ApiError(500, "boom"));
    renderFooter();

    await waitFor(() => expect(mockedFetchUseCases).toHaveBeenCalled());
    expect(document.querySelector(".app-footer__sources")).toBeNull();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("AI Calculator");
  });

  it("repeats the links to the secondary pages", () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);
    renderFooter();

    const nav = screen.getByRole("navigation", { name: "Site pages" });
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/methodologie",
      "/a-propos",
      "/mentions-legales",
    ]);
  });
});
