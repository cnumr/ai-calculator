import { describe, expect, it } from "vitest";
import type { Impacts, UseCase } from "../src/api/client";
import {
  computeAnnualEntries,
  resolveSelection,
} from "../src/domain/calculator";

const ZERO = { min: 0, max: 0 };
const gwpOnly = (value: number): Impacts => ({
  gwp: { min: value, max: value },
  energy: ZERO,
  adpe: ZERO,
  pe: ZERO,
  water: ZERO,
});

const VIDEO: UseCase = {
  id: "video",
  providers: [
    { providerId: "google", profiles: [{ id: "video", impacts: gwpOnly(1) }] },
  ],
};

const EMAIL: UseCase = {
  id: "email",
  providers: [
    {
      providerId: "openai",
      profiles: [
        { id: "eco", impacts: gwpOnly(10) },
        { id: "powerful", impacts: gwpOnly(20) },
      ],
    },
    { providerId: "google", profiles: [{ id: "eco", impacts: gwpOnly(100) }] },
  ],
};

describe("resolveSelection", () => {
  it("keeps the stored provider and profile when still offered", () => {
    const { mapping, profile } = resolveSelection(EMAIL, ["openai", "google"], {
      providerId: "openai",
      profileId: "powerful",
    });
    expect(mapping?.providerId).toBe("openai");
    expect(profile?.id).toBe("powerful");
  });

  it("falls back to the first offered provider and profile", () => {
    const { mapping, profile } = resolveSelection(EMAIL, ["openai"], {
      providerId: "google",
      profileId: "missing",
    });
    expect(mapping?.providerId).toBe("openai");
    expect(profile?.id).toBe("eco");
  });

  it("resolves nothing when no selected provider offers the use case", () => {
    const { offeredProviders, mapping, profile } = resolveSelection(
      VIDEO,
      ["openai"],
      { providerId: "google", profileId: "video" },
    );
    expect(offeredProviders).toEqual([]);
    expect(mapping).toBeUndefined();
    expect(profile).toBeUndefined();
  });
});

describe("computeAnnualEntries", () => {
  const states = {
    video: { providerId: "google", profileId: "video", frequencyPerDay: 1 },
    email: { providerId: "google", profileId: "eco", frequencyPerDay: 2 },
  };

  it("scales each card by frequency and working days", () => {
    const entries = computeAnnualEntries(
      [VIDEO, EMAIL],
      states,
      ["openai", "google"],
      10,
    );
    expect(entries).toEqual([
      { providerId: "google", impacts: gwpOnly(10) },
      { providerId: "google", impacts: gwpOnly(2000) },
    ]);
  });

  it("skips unsupported cards and attributes fallbacks to the provider used", () => {
    const entries = computeAnnualEntries([VIDEO, EMAIL], states, ["openai"], 10);
    expect(entries).toEqual([{ providerId: "openai", impacts: gwpOnly(200) }]);
  });

  it("ignores use cases without a card state", () => {
    expect(computeAnnualEntries([VIDEO], {}, ["google"], 10)).toEqual([]);
  });
});
