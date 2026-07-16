import { describe, expect, it } from "vitest";
import {
  aggregateByProvider,
  scaleImpacts,
  sumImpacts,
  zeroImpacts,
} from "../src/domain/aggregate";
import type { Impacts } from "../src/api/client";

const IMPACTS_A: Impacts = {
  gwp: { min: 1, max: 2 },
  energy: { min: 0.1, max: 0.2 },
  adpe: { min: 0.01, max: 0.02 },
  pe: { min: 1.5, max: 2.5 },
  water: { min: 3, max: 4 },
};

const IMPACTS_B: Impacts = {
  gwp: { min: 10, max: 20 },
  energy: { min: 1, max: 2 },
  adpe: { min: 0.1, max: 0.2 },
  pe: { min: 15, max: 25 },
  water: { min: 30, max: 40 },
};

describe("zeroImpacts", () => {
  it("returns all-zero ranges for every criterion", () => {
    const zero = zeroImpacts();
    for (const key of ["gwp", "energy", "adpe", "pe", "water"] as const) {
      expect(zero[key]).toEqual({ min: 0, max: 0 });
    }
  });
});

describe("scaleImpacts", () => {
  it("multiplies every min/max by the factor", () => {
    const scaled = scaleImpacts(IMPACTS_A, 10);
    expect(scaled.gwp).toEqual({ min: 10, max: 20 });
    expect(scaled.water).toEqual({ min: 30, max: 40 });
  });

  it("keeps a null criterion null regardless of the factor", () => {
    const withNullEnergy: Impacts = { ...IMPACTS_A, energy: null };
    const scaled = scaleImpacts(withNullEnergy, 10);
    expect(scaled.energy).toBeNull();
    expect(scaled.gwp).toEqual({ min: 10, max: 20 });
  });
});

describe("sumImpacts", () => {
  it("adds min/max per criterion across two impact sets", () => {
    const total = sumImpacts(IMPACTS_A, IMPACTS_B);
    expect(total.gwp).toEqual({ min: 11, max: 22 });
    expect(total.energy).toEqual({ min: 1.1, max: 2.2 });
  });

  it("treats a null operand as no contribution when the other has a value", () => {
    const withNullEnergy: Impacts = { ...IMPACTS_B, energy: null };
    const total = sumImpacts(IMPACTS_A, withNullEnergy);
    expect(total.energy).toEqual(IMPACTS_A.energy);
    expect(total.gwp).toEqual({ min: 11, max: 22 });
  });

  it("produces a null criterion only when both operands have it null", () => {
    const bothNull = sumImpacts(
      { ...IMPACTS_A, energy: null },
      { ...IMPACTS_B, energy: null },
    );
    expect(bothNull.energy).toBeNull();
  });
});

describe("aggregateByProvider", () => {
  it("sums impacts per provider id across multiple entries", () => {
    const result = aggregateByProvider([
      { providerId: "openai", impacts: IMPACTS_A },
      { providerId: "google", impacts: IMPACTS_B },
      { providerId: "openai", impacts: IMPACTS_A },
    ]);

    expect(Object.keys(result).sort()).toEqual(["google", "openai"]);
    expect(result.openai.gwp).toEqual({ min: 2, max: 4 });
    expect(result.google.gwp).toEqual({ min: 10, max: 20 });
  });

  it("returns an empty object for no entries", () => {
    expect(aggregateByProvider([])).toEqual({});
  });

  it("does not let one null criterion hide the value from other entries for a provider", () => {
    const withNullEnergy: Impacts = { ...IMPACTS_A, energy: null };
    const result = aggregateByProvider([
      { providerId: "openai", impacts: withNullEnergy },
      { providerId: "openai", impacts: IMPACTS_A },
    ]);

    expect(result.openai.energy).toEqual(IMPACTS_A.energy);
    expect(result.openai.gwp).toEqual({ min: 2, max: 4 });
  });
});
