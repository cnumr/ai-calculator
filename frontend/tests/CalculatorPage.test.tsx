import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { CalculatorPage } from "../src/pages/CalculatorPage";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return {
    ...actual,
    fetchUseCases: vi.fn(),
  };
});

const mockedFetchUseCases = vi.mocked(apiClient.fetchUseCases);

afterEach(() => {
  vi.clearAllMocks();
});

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

const CATALOG: apiClient.UseCasesCatalog = {
  providers: [
    { id: "openai", selectedByDefault: true },
    { id: "anthropic", selectedByDefault: false },
  ],
  useCases: [
    {
      id: "email",
      providers: [
        {
          providerId: "openai",
          profiles: [
            {
              id: "eco",
              impacts: { ...ZERO_IMPACTS, gwp: { min: 1, max: 2 } },
            },
          ],
        },
        {
          providerId: "anthropic",
          profiles: [
            {
              id: "eco",
              impacts: { ...ZERO_IMPACTS, gwp: { min: 3, max: 4 } },
            },
          ],
        },
      ],
    },
  ],
};

describe("CalculatorPage", () => {
  it("loads the catalogue once and renders one card per use case", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(1);
  });

  it("renders a chip per provider, initialised from selectedByDefault", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /openai/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /openai/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /anthropic/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches a card's provider away from a deselected chip", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /openai/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /anthropic/i }));
    await userEvent.click(screen.getByRole("button", { name: /openai/i }));

    const providerSelect = screen.getByLabelText(/fournisseur|provider/i);
    expect(providerSelect).toHaveValue("anthropic");
  });

  it("shows a full-page error with retry when the catalogue fails to load", async () => {
    mockedFetchUseCases.mockRejectedValueOnce(
      new apiClient.ApiError(500, "boom"),
    );
    mockedFetchUseCases.mockResolvedValueOnce(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(
          /impossible de charger le catalogue|could not load the use case catalogue/i,
        ),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /réessayer|retry/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(2);
  });

  it("aggregates individual annual impact from the card's gwp and frequency", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    const { container } = render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );

    // Default frequency is 1/day, 220 working days/year, gwp max = 2 -> 440
    // RangeGauge components render the max value in a <span class="range-gauge__value">
    const gauges = container.querySelectorAll(".range-gauge");
    const found = Array.from(gauges).some((gauge) =>
      gauge.textContent?.includes("440"),
    );
    expect(found).toBe(true);
  });

  it("shows the breakdown by provider with details for the other 4 indicators", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/répartition par fournisseur|breakdown by provider/i),
      ).toBeInTheDocument(),
    );
  });
});
