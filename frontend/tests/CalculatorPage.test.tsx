import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "../src/i18n";
import { CalculatorPage } from "../src/pages/CalculatorPage";
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
const ZERO = { min: 0, max: 0 };
const gwpKg = (kg: number): Impacts => ({
  gwp: { min: kg, max: kg },
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
    const daily = unit * u.frequencyPerDay;
    return {
      useCaseId: u.useCaseId,
      providerId: u.providerId,
      profileId: u.profileId,
      frequencyPerDay: u.frequencyPerDay,
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
/** Opens a card's "Customize" menu: its fields only exist once it is open. */
async function openCustomize(title: RegExp) {
  fireEvent.click(card(title).querySelector(".use-case-card__customize summary")!);
  await waitFor(() =>
    expect(card(title).querySelector(".use-case-card__parameters")).not.toBeNull(),
  );
}
const cardGwp = (title: RegExp) =>
  within(card(title)).getByTitle(/greenhouse gases/i).closest("div")!;

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
  for (const title of [/video generation/i, /writing an email/i]) {
    fireEvent.change(within(card(title)).getByLabelText("Average daily frequency"), {
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
    expect(screen.getByRole("heading", { name: /writing an email/i })).toBeInTheDocument();
  });

  it("renders a chip per provider, initialised from selectedByDefault", async () => {
    await renderLoaded();

    expect(screen.getByRole("button", { name: /openai/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /google/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("initializes each card with its catalogue provider and profile defaults", async () => {
    await renderLoaded();

    expect(within(card(/writing an email/i)).getByLabelText("Provider")).toHaveValue("google");
    expect(within(card(/writing an email/i)).getByLabelText("Profile")).toHaveValue("eco");
  });

  it("shows a full-page error with retry when the catalogue fails to load", async () => {
    mockedFetchUseCases.mockRejectedValueOnce(new apiClient.ApiError(500, "boom"));

    render(<CalculatorPage />);

    await userEvent.click(await screen.findByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("heading", { name: /writing an email/i })).toBeInTheDocument();
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(2);
  });
});

describe("CalculatorPage calculation (POST /api/calculate)", () => {
  it("starts every card at a frequency of 0", async () => {
    await renderDefault();

    for (const title of [/video generation/i, /writing an email/i]) {
      expect(within(card(title)).getByLabelText("Average daily frequency")).toHaveValue(0);
      expect(cardGwp(title)).toHaveTextContent("0 kg CO2eq");
    }
  });

  it("sends the scenario of the cards and the headcount", async () => {
    await renderDefault();

    expect(lastRequest()).toEqual({
      headcount: 1,
      usages: [
        {
          kind: "video",
          useCaseId: "video",
          providerId: "google",
          profileId: "video",
          frequencyPerDay: 0,
          parameters: { resolution: "720p" },
        },
        {
          kind: "text",
          useCaseId: "email",
          providerId: "google",
          profileId: "eco",
          frequencyPerDay: 0,
          parameters: {},
        },
      ],
    });
  });

  it("shows the daily impacts of each card and the breakdown returned", async () => {
    await renderLoaded();

    expect(cardGwp(/video generation/i)).toHaveTextContent("1.00 kg CO2eq");
    expect(cardGwp(/writing an email/i)).toHaveTextContent("100 kg CO2eq");
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

    const frequency = within(card(/writing an email/i)).getByLabelText("Average daily frequency");
    await user.clear(frequency);
    await user.type(frequency, "3");

    // video 1 + email 3 x 100 = 301 kg per day x 218
    await waitFor(() => expect(individualSummary()).toBe("65.6 t CO2eq"));
    expect(lastRequest().usages[1].frequencyPerDay).toBe(3);
  });

  it("waits for typing to settle before calling the backend", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const callsBefore = mockedCalculate.mock.calls.length;

    await user.type(
      within(card(/writing an email/i)).getByLabelText("Average daily frequency"),
      "234",
    );
    await waitFor(() => expect(lastRequest().usages[1].frequencyPerDay).toBe(1234));

    // One request for the settled value, not one per keystroke.
    expect(mockedCalculate.mock.calls.length - callsBefore).toBe(1);
  });

  it("recalculates with the chosen video parameters", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await openCustomize(/video generation/i);
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

    await openCustomize(/video generation/i);
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

    await openCustomize(/video generation/i);
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

    await openCustomize(/video generation/i);
    await user.selectOptions(within(card(/video generation/i)).getByLabelText("Resolution"), "1080p");
    await waitFor(() => expect(individualSummary()).toBe("22.2 t CO2eq"));
    await user.click(screen.getByRole("button", { name: /reset/i }));

    // Back to the defaults: frequencies at 0, 720p.
    await waitFor(() => expect(individualSummary()).toBe("0 kg CO2eq"));
    expect(lastRequest()).toEqual(initial);
  });

  it("drops a card no longer offered by any selected provider", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /google/i }));

    // video is unsupported, email falls back to openai: 10 kg x 218
    await waitFor(() => expect(individualSummary()).toBe("2.18 t CO2eq"));
    expect(lastRequest().usages.map((u) => u.useCaseId)).toEqual(["email"]);
  });

  it("attributes a card to the provider it falls back to", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(lastRequest().usages[0].providerId).toBe("openai"));
    await waitFor(() =>
      expect(document.querySelector(".provider-breakdown ul")).toHaveTextContent("OpenAI"),
    );
    expect(document.querySelector(".provider-breakdown ul")).not.toHaveTextContent("Google");
  });
});
