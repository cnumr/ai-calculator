import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "../src/i18n";
import { CalculatorPage } from "../src/pages/CalculatorPage";
import { MemoryRouter } from "react-router-dom";
import * as apiClient from "../src/api/client";
import type {
  CalculateRequest,
  CalculateResult,
  Impacts,
  UseCasesCatalog,
} from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchUseCases: vi.fn(), calculate: vi.fn() };
});

const mockedFetchUseCases = vi.mocked(apiClient.fetchUseCases);
const mockedCalculate = vi.mocked(apiClient.calculate);

// video is only offered by google; email falls back to openai without google.
const CATALOG: UseCasesCatalog = {
  providers: [
    { id: "openai", selectedByDefault: true },
    { id: "google", selectedByDefault: true },
  ],
  useCases: [
    {
      id: "video",
      kind: "video",
      defaultProviderId: "google",
      recommendedProfileId: "video",
      providers: [
        {
          providerId: "google",
          profiles: [
            {
              id: "video",
              parameters: [
                { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p", min: null, max: null },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "email",
      kind: "text",
      defaultProviderId: "google",
      recommendedProfileId: "eco",
      providers: [
        { providerId: "openai", profiles: [{ id: "eco" }] },
        { providerId: "google", profiles: [{ id: "eco" }] },
      ],
    },
  ],
};

/* A stand-in for the backend: kg CO2eq per action, GHG only. */
const UNIT_GWP_KG: Record<string, number> = {
  "video:google:video:720p": 1,
  "video:google:video:1080p": 2,
  "email:openai:eco:": 10,
  "email:google:eco:": 100,
};
const ZERO = { min: 0, max: 0, value: 0 };
const gwpKg = (kg: number): Impacts => ({
  gwp: { min: kg, max: kg, value: kg },
  energy: ZERO,
  adpe: ZERO,
  pe: ZERO,
  water: ZERO,
});

function fakeResult(request: CalculateRequest, scale = 1): CalculateResult {
  const usages = request.usages.map((u) => {
    const parameters = u.parameters ?? {};
    const unit =
      UNIT_GWP_KG[`${u.useCaseId}:${u.providerId}:${u.profileId}:${parameters.resolution ?? ""}`] *
      scale;
    // Same conversion as the backend: 43.6 weeks, 11 months a year.
    const perYear = { day: 218, week: 218 / 5, month: 11 }[u.frequencyUnit];
    const frequencyPerDay = (u.frequency * perYear) / 218;
    const daily = unit * frequencyPerDay;
    return {
      useCaseId: u.useCaseId,
      providerId: u.providerId,
      profileId: u.profileId,
      frequency: u.frequency,
      frequencyUnit: u.frequencyUnit,
      frequencyPerDay,
      parameters,
      unitImpacts: gwpKg(unit),
      dailyImpacts: gwpKg(daily),
      annualImpacts: gwpKg(daily * 218),
    };
  });
  const total = usages.reduce((sum, u) => sum + u.annualImpacts.gwp!.max, 0);
  const byProvider = new Map<string, number>();
  usages.forEach((u) =>
    byProvider.set(u.providerId, (byProvider.get(u.providerId) ?? 0) + u.annualImpacts.gwp!.max),
  );
  return {
    meta: {
      appVersion: "0.4.0",
      dataSources: [
        { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrievedOn: null, url: "https://ecologits.ai/" },
      ],
    },
    workingDaysPerYear: 218,
    usages,
    individualAnnual: gwpKg(total),
    enterpriseAnnual: gwpKg(total * request.headcount),
    providerBreakdown: [...byProvider].map(([providerId, kg]) => ({
      providerId,
      annualImpacts: gwpKg(kg),
      gwpSharePercent: total === 0 ? 0 : (kg / total) * 100,
    })),
    co2Equivalents: [
      { id: "car_km", impactCo2Slug: "voiturethermique", quantity: total / 0.142 },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const individualSummary = () =>
  document.querySelectorAll(".gwp-summary__value")[0]?.textContent;
const enterpriseSummary = () =>
  document.querySelectorAll(".gwp-summary__value")[1]?.textContent;
const lastRequest = () => mockedCalculate.mock.calls.at(-1)![0];
const card = (title: RegExp) =>
  screen.getByRole("heading", { name: title }).closest("article")!;
/** Opens a card's configuration: its selects and fields only exist once open. */
async function openConfigure(title: RegExp) {
  fireEvent.click(within(card(title)).getByRole("button", { name: /^configure –/i }));
  await waitFor(() =>
    expect(card(title).querySelector(".use-case-card__panel")).not.toBeNull(),
  );
}
const cardGwp = (title: RegExp) =>
  within(card(title)).getByTitle(/greenhouse gases/i).closest(".use-case-card__summary-item")!;

beforeEach(async () => {
  await i18next.changeLanguage("en");
  mockedFetchUseCases.mockResolvedValue(CATALOG);
  mockedCalculate.mockImplementation(async (request) => fakeResult(request));
});

afterEach(() => {
  vi.clearAllMocks();
});

/** The page as it opens: every card at a frequency of 0. */
async function renderDefault() {
  const view = render(<CalculatorPage />);
  await waitFor(() => expect(individualSummary()).toBe("0 kg CO2eq"));
  return view;
}

/** The page with each card used once a day. */
async function renderLoaded() {
  const view = await renderDefault();
  for (const title of [/video generation/i, /writing a short email/i]) {
    fireEvent.change(within(card(title)).getByLabelText("Average frequency"), {
      target: { value: "1" },
    });
  }
  // video 1 kg + email (google) 100 kg per day, over 218 days = 22 018 kg
  await waitFor(() => expect(individualSummary()).toBe("22.0 t CO2eq"));
  return view;
}

describe("CalculatorPage catalogue", () => {
  it("loads the catalogue once and renders one card per use case", async () => {
    await renderLoaded();

    expect(mockedFetchUseCases).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: /video generation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /writing a short email/i })).toBeInTheDocument();
  });

  it("renders a chip per provider, initialised from selectedByDefault", async () => {
    await renderLoaded();

    expect(screen.getByRole("button", { name: /^openai/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^google/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("initializes each card with its catalogue provider and profile defaults", async () => {
    await renderLoaded();
    await openConfigure(/writing a short email/i);

    expect(within(card(/writing a short email/i)).getByLabelText("Provider")).toHaveValue("google");
    expect(within(card(/writing a short email/i)).getByLabelText("Profile")).toHaveValue("eco");
  });

  it("shows a full-page error with retry when the catalogue fails to load", async () => {
    mockedFetchUseCases.mockRejectedValueOnce(new apiClient.ApiError(500, "boom"));

    render(<CalculatorPage />);

    await userEvent.click(await screen.findByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("heading", { name: /writing a short email/i })).toBeInTheDocument();
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(2);
  });
});

describe("CalculatorPage families", () => {
  it("lists use cases under a heading per family, in the catalogue order", async () => {
    mockedFetchUseCases.mockResolvedValueOnce({
      ...CATALOG,
      families: ["writing", "visual"],
      useCases: CATALOG.useCases.map((uc) => ({
        ...uc,
        family: uc.id === "video" ? "visual" : "writing",
      })),
    });
    await renderDefault();

    const families = screen
      .getAllByRole("region")
      .filter((region) => region.classList.contains("use-case-family"));
    expect(families.map((region) => region.getAttribute("aria-labelledby"))).toEqual([
      "family-writing",
      "family-visual",
    ]);
    expect(within(families[0]).getByRole("heading", { name: "Writing" })).toBeInTheDocument();
    expect(families[0]).toContainElement(card(/writing a short email/i));
    expect(families[1]).toContainElement(card(/video generation/i));
  });

  it("lists use cases without a heading when the catalogue has no families", async () => {
    await renderDefault();

    expect(screen.queryByRole("heading", { name: "Writing" })).not.toBeInTheDocument();
    expect(card(/video generation/i)).toBeInTheDocument();
  });
});

describe("CalculatorPage only-my-usages filter", () => {
  const filter = () => screen.getByRole("checkbox", { name: /only my usages/i });
  const setFrequency = (title: RegExp, value: string) =>
    fireEvent.change(within(card(title)).getByLabelText("Average frequency"), {
      target: { value },
    });

  it("is disabled until a use case has a frequency, and counts the used ones", async () => {
    await renderDefault();

    expect(filter()).toBeDisabled();
    expect(filter()).toHaveAccessibleName("Only my usages (0)");

    setFrequency(/writing a short email/i, "2");

    expect(filter()).toBeEnabled();
    expect(filter()).toHaveAccessibleName("Only my usages (1)");
  });

  it("lists only the used use cases, and keeps a row cleared while it is on", async () => {
    await renderDefault();
    setFrequency(/writing a short email/i, "2");

    fireEvent.click(filter());

    expect(screen.queryByRole("heading", { name: /video generation/i })).not.toBeInTheDocument();
    expect(card(/writing a short email/i)).toBeInTheDocument();
    // Cleared while editing: the row stays until the filter is turned off.
    setFrequency(/writing a short email/i, "");
    expect(card(/writing a short email/i)).toBeInTheDocument();

    fireEvent.click(filter());
    expect(card(/video generation/i)).toBeInTheDocument();
  });

  it("is turned off by the reset", async () => {
    await renderDefault();
    setFrequency(/writing a short email/i, "2");
    fireEvent.click(filter());

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(filter()).not.toBeChecked();
    expect(card(/video generation/i)).toBeInTheDocument();
  });
});

describe("CalculatorPage calculation (POST /api/calculate)", () => {
  it("starts every card at a frequency of 0", async () => {
    await renderDefault();

    for (const title of [/video generation/i, /writing a short email/i]) {
      // 0 is a placeholder, so that typing replaces it.
      const input = within(card(title)).getByLabelText("Average frequency");
      expect(input).toHaveValue(null);
      expect(input).toHaveAttribute("placeholder", "0");
      expect(cardGwp(title)).toHaveTextContent("0 kg CO2eq");
    }
  });

  it("types a frequency without keeping the leading 0", async () => {
    await renderDefault();

    const input = within(card(/writing a short email/i)).getByLabelText("Average frequency");
    await userEvent.type(input, "10");

    expect(input).toHaveDisplayValue("10");
  });

  it("types a headcount without keeping a leading 0 once the field is emptied (issue #60)", async () => {
    await renderDefault();

    const input = screen.getByLabelText(/headcount/i);
    await userEvent.clear(input);
    expect(input).toHaveDisplayValue("");
    // An emptied field counts as 1 person for the calculation.
    await waitFor(() => expect(lastRequest().headcount).toBe(1));

    await userEvent.type(input, "500");
    expect(input).toHaveDisplayValue("500");
    await waitFor(() => expect(lastRequest().headcount).toBe(500));
  });

  it("sends the scenario of the cards and the headcount", async () => {
    await renderDefault();

    expect(lastRequest()).toEqual({
      headcount: 1000,
      usages: [
        {
          kind: "video",
          useCaseId: "video",
          providerId: "google",
          profileId: "video",
          frequency: 0,
          frequencyUnit: "day",
          parameters: { resolution: "720p" },
        },
        {
          kind: "text",
          useCaseId: "email",
          providerId: "google",
          profileId: "eco",
          frequency: 0,
          frequencyUnit: "day",
          parameters: {},
        },
      ],
    });
  });

  it("shows the daily impacts of each card and the breakdown returned", async () => {
    await renderLoaded();

    expect(cardGwp(/video generation/i)).toHaveTextContent("1.00 kg CO2eq");
    expect(cardGwp(/writing a short email/i)).toHaveTextContent("100 kg CO2eq");
    const breakdown = document.querySelector(".provider-breakdown")!;
    expect(breakdown).toHaveTextContent("Google");
    expect(breakdown).toHaveTextContent("100 %");
  });

  it("shows each provider's logo next to its name in the breakdown", async () => {
    await renderLoaded();

    const name = document.querySelector(".provider-breakdown__name")!;
    expect(name).toHaveTextContent("Google");
    expect(name.querySelector("img.provider-breakdown__logo")).toHaveAttribute("alt", "");
  });

  it("shows the CO2 equivalents returned", async () => {
    await renderLoaded();

    // 22 018 kg / 0.142 kg per km
    expect(screen.getByText("155,056 km by car")).toBeInTheDocument();
  });

  it("recalculates with the new frequency", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const frequency = within(card(/writing a short email/i)).getByLabelText("Average frequency");
    await user.clear(frequency);
    await user.type(frequency, "3");

    // video 1 + email 3 x 100 = 301 kg per day x 218
    await waitFor(() => expect(individualSummary()).toBe("65.6 t CO2eq"));
    expect(lastRequest().usages[1].frequency).toBe(3);
  });

  it("recalculates with the chosen frequency unit", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.selectOptions(
      within(card(/writing a short email/i)).getByLabelText("Frequency unit"),
      "week",
    );

    // email once a week = 0.2 a working day: (1 + 0.2 x 100) kg x 218
    await waitFor(() => expect(individualSummary()).toBe("4.58 t CO2eq"));
    expect(lastRequest().usages[1]).toMatchObject({ frequency: 1, frequencyUnit: "week" });
  });

  it("waits for typing to settle before calling the backend", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const callsBefore = mockedCalculate.mock.calls.length;

    await user.type(
      within(card(/writing a short email/i)).getByLabelText("Average frequency"),
      "234",
    );
    await waitFor(() => expect(lastRequest().usages[1].frequency).toBe(1234));

    // One request for the settled value, not one per keystroke.
    expect(mockedCalculate.mock.calls.length - callsBefore).toBe(1);
  });

  it("recalculates with the chosen video parameters", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await openConfigure(/video generation/i);
    await user.selectOptions(within(card(/video generation/i)).getByLabelText("Resolution"), "1080p");

    await waitFor(() => expect(cardGwp(/video generation/i)).toHaveTextContent("2.00 kg CO2eq"));
    expect(lastRequest().usages[0].parameters).toEqual({ resolution: "1080p" });
    expect(individualSummary()).toBe("22.2 t CO2eq");
  });

  it("sends the headcount and shows the enterprise total returned", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const headcount = screen.getByLabelText(/headcount/i);
    await user.clear(headcount);
    await user.type(headcount, "50");

    await waitFor(() => expect(enterpriseSummary()).toBe("1,101 t CO2eq"));
    expect(lastRequest().headcount).toBe(50);
  });

  it("keeps the last result and offers a retry when the calculation fails", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    mockedCalculate.mockRejectedValueOnce(new apiClient.ApiError(500, "boom"));

    await openConfigure(/video generation/i);
    await user.selectOptions(within(card(/video generation/i)).getByLabelText("Resolution"), "1080p");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/error/i);
    expect(individualSummary()).toBe("22.0 t CO2eq");

    await user.click(within(alert).getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(individualSummary()).toBe("22.2 t CO2eq"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a late response to an outdated scenario", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const late = deferred<CalculateResult>();
    mockedCalculate.mockImplementationOnce(() => late.promise);

    await openConfigure(/video generation/i);
    const resolution = within(card(/video generation/i)).getByLabelText("Resolution");
    await user.selectOptions(resolution, "1080p");
    await waitFor(() =>
      expect(lastRequest().usages[0].parameters).toEqual({ resolution: "1080p" }),
    );
    const outdated = mockedCalculate.mock.calls.at(-1)!;

    // While the 1080p calculation is in flight, the card is marked busy.
    expect(card(/video generation/i)).toHaveAttribute("aria-busy", "true");

    await user.selectOptions(resolution, "720p");
    await waitFor(() => expect(outdated[1]!.aborted).toBe(true));
    await waitFor(() => expect(card(/video generation/i)).not.toHaveAttribute("aria-busy"));

    // The outdated answer (scaled x10) arrives last: it must not be shown.
    late.resolve(fakeResult(outdated[0], 10));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cardGwp(/video generation/i)).toHaveTextContent("1.00 kg CO2eq");
    expect(individualSummary()).toBe("22.0 t CO2eq");
  });

  it("renders the breakdown details only once their panel is opened", async () => {
    await renderLoaded();
    const breakdown = document.querySelector<HTMLElement>(".provider-breakdown")!;

    // Closed: no per-provider grid in the DOM (RWEB_0046).
    expect(breakdown.querySelector(".impacts-grid")).toBeNull();

    fireEvent.click(within(breakdown).getByText(/show\/hide the impact details/i));

    await waitFor(() => expect(breakdown.querySelectorAll(".impacts-grid")).toHaveLength(1));
    expect(breakdown.querySelector(".impacts-grid")).toHaveTextContent("Google");
  });

  it("shows the five impact icons in annual and provider detail grids", async () => {
    const { container } = await renderLoaded();

    const grids = container.querySelectorAll(".impacts-grid");
    expect(grids.length).toBeGreaterThan(0);
    grids.forEach((grid) => {
      expect(grid.querySelectorAll(".impact-icon--detail")).toHaveLength(5);
    });
  });
});

describe("CalculatorPage keeps the scenario consistent with the cards", () => {
  it("sends the default scenario again after a reset", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const initial = mockedCalculate.mock.calls[0][0];

    await openConfigure(/video generation/i);
    await user.selectOptions(within(card(/video generation/i)).getByLabelText("Resolution"), "1080p");
    await waitFor(() => expect(individualSummary()).toBe("22.2 t CO2eq"));
    const headcount = screen.getByLabelText(/headcount/i);
    await user.clear(headcount);
    await user.type(headcount, "50");
    await user.click(screen.getByRole("button", { name: /reset/i }));

    // Back to the defaults: frequencies at 0, 720p, 1000 employees.
    expect(headcount).toHaveValue(1000);
    await waitFor(() => expect(individualSummary()).toBe("0 kg CO2eq"));
    expect(lastRequest()).toEqual(initial);
  });

  it("drops a card no longer offered by any selected provider", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /^google/i }));

    // video is unsupported, email falls back to openai: 10 kg x 218
    await waitFor(() => expect(individualSummary()).toBe("2.18 t CO2eq"));
    expect(lastRequest().usages.map((u) => u.useCaseId)).toEqual(["email"]);
  });

  it("attributes a card to the provider it falls back to", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /^google/i }));

    await waitFor(() => expect(lastRequest().usages[0].providerId).toBe("openai"));
    await waitFor(() =>
      expect(document.querySelector(".provider-breakdown ul")).toHaveTextContent("OpenAI"),
    );
    expect(document.querySelector(".provider-breakdown ul")).not.toHaveTextContent("Google");
  });
});

describe("CalculatorPage guided tour", () => {
  beforeEach(() => localStorage.removeItem("ai-calculator-tour-seen"));

  async function renderWithRouter() {
    render(
      <MemoryRouter>
        <CalculatorPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(individualSummary()).toBe("0 kg CO2eq"));
  }

  it("invites to the tour, loads it on click only, and stops inviting once left", async () => {
    const user = userEvent.setup();
    await renderWithRouter();
    const calls = mockedCalculate.mock.calls.length;

    const button = screen.getByRole("button", {
      name: /^Guided tour\s*\(recommended for a first visit\)$/,
    });
    expect(button).toHaveClass("calculator-tour-button--invite");
    // Not loaded before the click (RWEB_0046).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "1 / 9 Your AI ecosystem" });
    // The tour outlines the real providers.
    expect(document.querySelector('[data-tour="ecosystem"]')).toHaveAttribute("data-tour-active");

    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    // On the short email card.
    expect(
      card(/writing a short email/i).querySelector('[data-tour="configure"]'),
    ).toHaveAttribute("data-tour-active");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[data-tour-active]")).toBeNull();
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Guided tour");
    expect(button).not.toHaveClass("calculator-tour-button--invite");
    expect(localStorage.getItem("ai-calculator-tour-seen")).toBe("1");
    // The tour tells about the scenario, it does not change it.
    expect(mockedCalculate.mock.calls.length).toBe(calls);
  });

  it("no longer invites once the tour has been seen in this browser", async () => {
    localStorage.setItem("ai-calculator-tour-seen", "1");
    await renderWithRouter();

    expect(screen.getByRole("button", { name: "Guided tour" })).not.toHaveClass(
      "calculator-tour-button--invite",
    );
  });
});

describe("CalculatorPage export", () => {
  const exportButton = () => screen.getByRole("button", { name: "Export" });

  it("is unavailable until a use case has a frequency, and its tooltip says why", async () => {
    await renderDefault();

    expect(exportButton()).toHaveAttribute("aria-disabled", "true");
    expect(exportButton()).toHaveAccessibleDescription(/Available once a use case has a frequency/);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(exportButton());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("describes each page action, for the tooltip and screen readers", async () => {
    await renderLoaded();

    expect(exportButton()).toHaveAttribute("aria-disabled", "false");
    expect(exportButton()).toHaveAccessibleDescription(/^Export your inputs and their impacts in JSON format/);
    expect(screen.getByRole("button", { name: "Import" })).toHaveAccessibleDescription(
      /^Reload an exported file/,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toHaveAccessibleDescription(
      /^Restore every default value/,
    );
    expect(screen.getByRole("button", { name: /^Guided tour/ })).toHaveAccessibleDescription(
      /^Discover the calculator/,
    );
  });

  it("saves the inputs and the results as a JSON file, without calling the backend", async () => {
    const files: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      files.push(blob);
      return "blob:export";
    });
    // Not implemented by jsdom.
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await renderLoaded();
    const calls = mockedCalculate.mock.calls.length;

    fireEvent.click(exportButton());

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^ai-calculator-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await files[0].text());
    expect(file).toMatchObject({ format: "ai-calculator-export", app_version: "0.4.0", language: "en" });
    expect(file.input.headcount).toBe(1000);
    expect(file.input.usages.map((u: { use_case_id: string }) => u.use_case_id)).toEqual([
      "video",
      "email",
    ]);
    expect(file.result.individual_annual.gwp.max).toBeCloseTo(22018);
    expect(file.result.enterprise_annual.gwp.max).toBeCloseTo(22018000);
    expect(mockedCalculate).toHaveBeenCalledTimes(calls);
    click.mockRestore();
  });
});

describe("CalculatorPage import", () => {
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const exportFile = (overrides: Record<string, unknown> = {}) =>
    new File(
      [
        JSON.stringify({
          format: "ai-calculator-export",
          format_version: 1,
          app_version: "0.4.0",
          input: {
            selected_providers: ["openai"],
            headcount: 20,
            usages: [
              {
                kind: "text",
                use_case_id: "email",
                provider_id: "openai",
                profile_id: "eco",
                frequency: 2,
                frequency_unit: "day",
                parameters: {},
              },
            ],
          },
          result: { individual_annual: { gwp: { min: 9, max: 9, value: 9 } } },
          ...overrides,
        }),
      ],
      "ai-calculator-2026-11-25.json",
      { type: "application/json" },
    );

  it("opens the file picker from the Import button, placed after Export", async () => {
    await renderDefault();
    const click = vi.spyOn(fileInput(), "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(click).toHaveBeenCalledTimes(1);
    const actions = [...document.querySelectorAll(".calculator-hero__actions button")].map(
      (b) => b.textContent,
    );
    expect(actions).toEqual(["Guided tour", "Export", "Import", "Reset"]);
  });

  it("restores the inputs and recalculates them in a single call, ignoring the file's results", async () => {
    await renderDefault();
    const calls = mockedCalculate.mock.calls.length;

    await userEvent.upload(fileInput(), exportFile());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 use case imported"));
    expect(screen.getByRole("status")).not.toHaveTextContent("other versions");
    // email with openai at 10 kg, twice a day over 218 days, for 20 people.
    await waitFor(() => expect(individualSummary()).toBe("4.36 t CO2eq"));
    expect(enterpriseSummary()).toBe("87.2 t CO2eq");
    expect(mockedCalculate).toHaveBeenCalledTimes(calls + 1);
    expect(lastRequest()).toEqual({
      headcount: 20,
      usages: [
        {
          kind: "text",
          useCaseId: "email",
          providerId: "openai",
          profileId: "eco",
          frequency: 2,
          frequencyUnit: "day",
          parameters: {},
        },
      ],
    });
    expect(screen.getByRole("button", { name: /^openai/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^google/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("warns when the file was made with other versions than those of the recalculation", async () => {
    await renderDefault();

    await userEvent.upload(
      fileInput(),
      exportFile({
        app_version: "0.0.1",
        data_sources: [{ id: "ecologits", name: "EcoLogits", version: "0.10.0", retrieved_on: null }],
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "This file was created with other versions (AI Calculator 0.0.1 → 0.4.0, EcoLogits 0.10.0 → 0.11.3)",
    );
  });

  it("keeps the current inputs when the file is not an export", async () => {
    await renderLoaded();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls = mockedCalculate.mock.calls.length;

    await userEvent.upload(
      fileInput(),
      new File(["{}"], "other.json", { type: "application/json" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This file is not an export of the calculator.",
    );
    expect(individualSummary()).toBe("22.0 t CO2eq");
    expect(mockedCalculate).toHaveBeenCalledTimes(calls);
  });

  it("asks before replacing the current inputs, and keeps them when declined", async () => {
    await renderLoaded();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.upload(fileInput(), exportFile());

    expect(confirm).toHaveBeenCalledWith("Replace your current inputs with the file's?");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(individualSummary()).toBe("22.0 t CO2eq");
  });

  it("restores exactly what was exported", async () => {
    const files: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        files.push(blob);
        return "blob:export";
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await renderLoaded();
    const exported = lastRequest();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(files).toHaveLength(1));
    click.mockRestore();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(individualSummary()).toBe("0 kg CO2eq"));
    await userEvent.upload(fileInput(), new File([await files[0].text()], "export.json"));

    await waitFor(() => expect(individualSummary()).toBe("22.0 t CO2eq"));
    expect(lastRequest()).toEqual(exported);
  });
});
