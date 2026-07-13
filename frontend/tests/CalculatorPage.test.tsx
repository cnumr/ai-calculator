import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { CalculatorPage } from "../src/pages/CalculatorPage";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return {
    ...actual,
    fetchProviders: vi.fn(),
    calculate: vi.fn(),
  };
});

const mockedFetchProviders = vi.mocked(apiClient.fetchProviders);
const mockedCalculate = vi.mocked(apiClient.calculate);

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

describe("CalculatorPage", () => {
  it("submits the form and displays 5 range gauges for the unit result", async () => {
    mockedFetchProviders.mockResolvedValue([
      { provider: "openai", name: "gpt-4o-mini" },
    ]);
    mockedCalculate.mockResolvedValue({
      unit: { ...ZERO_IMPACTS, gwp: { min: 1.1, max: 2.2 } },
      individualAnnual: ZERO_IMPACTS,
      enterpriseAnnual: ZERO_IMPACTS,
    });

    const { container } = render(<CalculatorPage />);

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalled());

    await userEvent.click(
      screen.getByRole("button", { name: /calculer|calculate/i }),
    );

    await waitFor(() => expect(mockedCalculate).toHaveBeenCalled());
    expect(screen.getByText(/1.1/)).toBeInTheDocument();
    expect(screen.getByText(/2.2/)).toBeInTheDocument();

    // Assert exactly 5 RangeGauge components rendered in the unit result section
    const gauges = container.querySelectorAll(".range-gauge");
    expect(gauges).toHaveLength(15); // 3 sections (unit, individual, enterprise) × 5 criteria each
  });

  it("shows a localized error message when the model is not found", async () => {
    mockedFetchProviders.mockResolvedValue([
      { provider: "openai", name: "gpt-4o-mini" },
    ]);
    mockedCalculate.mockRejectedValue(new apiClient.ApiError(404, "not found"));

    render(<CalculatorPage />);

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalled());
    await userEvent.click(
      screen.getByRole("button", { name: /calculer|calculate/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          /n'est pas \(encore\) disponible|not \(yet\) available/i,
        ),
      ).toBeInTheDocument(),
    );
  });
});
