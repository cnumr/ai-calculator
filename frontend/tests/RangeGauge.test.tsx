import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RangeGauge, gaugePositions } from "../src/components/RangeGauge";

describe("gaugePositions", () => {
  it("places the tick on the estimated value, scaled to max * 1.1", () => {
    const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(10, 30, 20);

    const scale = 30 * 1.1;
    expect(fillLeftPct).toBeCloseTo((10 / scale) * 100, 1);
    expect(fillRightPct).toBeCloseTo(100 - (30 / scale) * 100, 1);
    expect(tickLeftPct).toBeCloseTo((20 / scale) * 100, 1);
  });

  it("returns a full-width fill when max is 0", () => {
    const { fillLeftPct, fillRightPct } = gaugePositions(0, 0, 0);

    expect(fillLeftPct).toBe(0);
    expect(fillRightPct).toBe(100);
  });
});

describe("RangeGauge", () => {
  it("renders the label, min and max bounds", () => {
    render(<RangeGauge range={{ min: 1.2, max: 3.4, value: 2.3 }} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText("GWP")).toBeInTheDocument();
    expect(screen.getByText(/1.2/)).toBeInTheDocument();
    expect(screen.getByText(/3.4/)).toBeInTheDocument();
  });

  it("shows the estimated value marked by the tick, in the bounds' unit", () => {
    render(<RangeGauge range={{ min: 2530, max: 3090, value: 2810 }} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText(/2[.,]81 t CO2eq/)).toHaveClass("range-gauge__value");
  });

  it("shows the value given by the backend, without computing it", () => {
    render(<RangeGauge range={{ min: 2, max: 4, value: 3.5 }} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText(/3[.,]50 kg CO2eq/)).toHaveClass("range-gauge__value");
  });

  it("scales tiny values to a readable unit instead of scientific notation", () => {
    render(
      <RangeGauge
        range={{ min: 0.00000001, max: 0.00000002, value: 0.000000015 }}
        unit="kgSbeq"
        label="ADPe"
      />,
    );

    expect(screen.getByText(/0.0100 mg Sbeq/)).toBeInTheDocument();
    expect(screen.getByText(/0.0200 mg Sbeq/)).toBeInTheDocument();
  });

  it("scales large values up to a coarser unit", () => {
    render(<RangeGauge range={{ min: 1500, max: 2500, value: 2000 }} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText(/1.50 t CO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/2.50 t CO2eq/)).toBeInTheDocument();
  });
});
