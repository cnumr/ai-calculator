import { describe, expect, it } from "vitest";
import { formatNumber, scaleRange } from "../src/domain/units";

describe("formatNumber", () => {
  it("formats zero as 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("keeps two decimals for values around 1", () => {
    expect(formatNumber(1.2)).toBe("1.20");
  });

  it("never uses scientific notation for very small values", () => {
    const result = formatNumber(0.0000001);
    expect(result).not.toMatch(/e/i);
    expect(result).toBe("0.000000100");
  });

  it("never uses scientific notation for very large values", () => {
    const result = formatNumber(123456789);
    expect(result).not.toMatch(/e/i);
  });
});

describe("scaleRange", () => {
  it("keeps the base unit when values are already in a readable range", () => {
    const result = scaleRange(1.2, 3.4, "kgCO2eq");
    expect(result).toEqual({ min: 1.2, max: 3.4, unit: "kgCO2eq" });
  });

  it("scales tiny kgCO2eq values down to grams", () => {
    const result = scaleRange(0.001, 0.005, "kgCO2eq");
    expect(result.unit).toBe("gCO2eq");
    expect(result.min).toBeCloseTo(1);
    expect(result.max).toBeCloseTo(5);
  });

  it("scales large kgCO2eq values up to tonnes", () => {
    const result = scaleRange(1500, 2500, "kgCO2eq");
    expect(result.unit).toBe("tCO2eq");
    expect(result.min).toBeCloseTo(1.5);
    expect(result.max).toBeCloseTo(2.5);
  });

  it("scales tiny kgSbeq (ADPe) values down to milligrams", () => {
    const result = scaleRange(0.00000001, 0.00000002, "kgSbeq");
    expect(result.unit).toBe("mgSbeq");
    expect(result.min).toBeCloseTo(0.01);
    expect(result.max).toBeCloseTo(0.02);
  });

  it("scales kWh values up to MWh for large enterprise totals", () => {
    const result = scaleRange(1200, 3400, "kWh");
    expect(result.unit).toBe("MWh");
    expect(result.min).toBeCloseTo(1.2);
    expect(result.max).toBeCloseTo(3.4);
  });

  it("scales MJ values up to GJ for large enterprise totals", () => {
    const result = scaleRange(2000, 5000, "MJ");
    expect(result.unit).toBe("GJ");
    expect(result.min).toBeCloseTo(2);
    expect(result.max).toBeCloseTo(5);
  });

  it("scales L values up to cubic metres for large enterprise totals", () => {
    const result = scaleRange(1500, 4500, "L");
    expect(result.unit).toBe("m³");
    expect(result.min).toBeCloseTo(1.5);
    expect(result.max).toBeCloseTo(4.5);
  });

  it("passes through an unknown base unit unscaled", () => {
    const result = scaleRange(1, 2, "unknown");
    expect(result).toEqual({ min: 1, max: 2, unit: "unknown" });
  });

  it("picks the finest unit available when even the smallest still rounds below 1", () => {
    const result = scaleRange(0.0000004, 0.0000004, "kWh");
    expect(result.unit).toBe("Wh");
  });
});
