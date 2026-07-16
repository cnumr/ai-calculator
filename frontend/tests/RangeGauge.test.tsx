import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RangeGauge, gaugePositions } from "../src/components/RangeGauge";

describe("gaugePositions", () => {
  it("places the tick at the midpoint of min and max, scaled to max * 1.1", () => {
    const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(10, 30);

    const scale = 30 * 1.1;
    expect(fillLeftPct).toBeCloseTo((10 / scale) * 100, 1);
    expect(fillRightPct).toBeCloseTo(100 - (30 / scale) * 100, 1);
    expect(tickLeftPct).toBeCloseTo(((10 + 30) / 2 / scale) * 100, 1);
  });

  it("returns a full-width fill when max is 0", () => {
    const { fillLeftPct, fillRightPct } = gaugePositions(0, 0);

    expect(fillLeftPct).toBe(0);
    expect(fillRightPct).toBe(100);
  });
});

describe("RangeGauge", () => {
  it("renders the label, min and max bounds", () => {
    render(<RangeGauge min={1.2} max={3.4} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText("GWP")).toBeInTheDocument();
    expect(screen.getByText(/1.2/)).toBeInTheDocument();
    expect(screen.getByText(/3.4/)).toBeInTheDocument();
  });

  it("scales tiny values to a readable unit instead of scientific notation", () => {
    render(
      <RangeGauge
        min={0.00000001}
        max={0.00000002}
        unit="kgSbeq"
        label="ADPe"
      />,
    );

    expect(screen.getByText(/0.0100 mgSbeq/)).toBeInTheDocument();
    expect(screen.getByText(/0.0200 mgSbeq/)).toBeInTheDocument();
  });

  it("scales large values up to a coarser unit", () => {
    render(<RangeGauge min={1500} max={2500} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText(/1.50 tCO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/2.50 tCO2eq/)).toBeInTheDocument();
  });
});
