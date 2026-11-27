import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../src/i18n";
import { RangeGauge, gaugePositions } from "../src/components/RangeGauge";

beforeEach(async () => {
  await i18n.changeLanguage("fr");
});

describe("gaugePositions", () => {
  it("places the band and the tick on a scale from 0 to a round number above max", () => {
    const { fillLeftPct, fillRightPct, tickLeftPct, scaleMax } = gaugePositions(1.31, 2.49, 1.9);

    expect(scaleMax).toBe(2.5);
    expect(fillLeftPct).toBeCloseTo((1.31 / 2.5) * 100, 6);
    expect(fillRightPct).toBeCloseTo(100 - (2.49 / 2.5) * 100, 6);
    expect(tickLeftPct).toBeCloseTo((1.9 / 2.5) * 100, 6);
  });

  it("returns an empty scale when max is 0", () => {
    expect(gaugePositions(0, 0, 0)).toEqual({
      fillLeftPct: 0,
      fillRightPct: 100,
      tickLeftPct: 0,
      scaleMax: 0,
    });
  });
});

const estimate = () => document.querySelector(".range-gauge__estimate")!;
const scale = () =>
  Array.from(document.querySelectorAll(".range-gauge__scale span")).map((s) => s.textContent);

describe("RangeGauge", () => {
  it("shows low < value < high, the low and high values without their unit", () => {
    render(<RangeGauge range={{ min: 1.31, max: 2.49, value: 1.9 }} unit="kgCO2eq" label="GES" />);

    expect(screen.getByText("GES")).toBeInTheDocument();
    expect(estimate()).toHaveTextContent(/^1,31 < 1,90 kg CO2eq < 2,49$/);
    const [low, value, high] = estimate().querySelectorAll(".range-gauge__bound, .range-gauge__value");
    expect(low).toHaveTextContent(/^1,31$/);
    expect(low).toHaveAttribute("title", "Estimation basse");
    expect(value).toHaveClass("range-gauge__value");
    expect(value).toHaveTextContent(/^1,90 kg CO2eq$/);
    expect(high).toHaveTextContent(/^2,49$/);
    expect(high).toHaveAttribute("title", "Estimation haute");
  });

  it("shows the absolute scale under the gauge: 0 on the left, a round number on the right", () => {
    render(<RangeGauge range={{ min: 1.31, max: 2.49, value: 1.9 }} unit="kgCO2eq" label="GES" />);

    expect(scale()).toEqual(["0", "2,50 kg CO2eq"]);
  });

  it("tells screen readers the estimate and its range in one sentence", () => {
    render(<RangeGauge range={{ min: 1.31, max: 2.49, value: 1.9 }} unit="kgCO2eq" label="GES" />);

    expect(
      screen.getByText("Estimation : 1,90 kg CO2eq, entre 1,31 et 2,49 kg CO2eq"),
    ).toHaveClass("visually-hidden");
    expect(estimate().parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("scales the values and the scale to a readable unit", () => {
    render(
      <RangeGauge
        range={{ min: 0.00000001, max: 0.00000002, value: 0.000000015 }}
        unit="kgSbeq"
        label="ADPe"
      />,
    );

    expect(estimate()).toHaveTextContent("0,0100 < 0,0150 mg Sbeq < 0,0200");
    expect(scale()).toEqual(["0", "0,0200 mg Sbeq"]);
  });

  it("scales large values up to a coarser unit", () => {
    render(<RangeGauge range={{ min: 1500, max: 2500, value: 2000 }} unit="kgCO2eq" label="GES" />);

    expect(estimate()).toHaveTextContent("1,50 < 2,00 t CO2eq < 2,50");
    expect(scale()).toEqual(["0", "2,50 t CO2eq"]);
  });
});
