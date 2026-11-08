import { describe, expect, it } from "vitest";
import type { Impacts, Profile, UseCase } from "../src/api/client";
import {
  computeAnnualEntries,
  resolveImpacts,
  resolveParameters,
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
    video: { providerId: "google", profileId: "video", frequencyPerDay: 1, parameters: {} },
    email: { providerId: "google", profileId: "eco", frequencyPerDay: 2, parameters: {} },
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

const VIDEO_PROFILE: Profile = {
  id: "video",
  impacts: gwpOnly(8),
  parameters: [
    { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p" },
    { id: "duration_s", options: [5, 8, 10], defaultValue: 8 },
  ],
  variants: [
    { values: { resolution: "720p", duration_s: 5 }, impacts: gwpOnly(5) },
    { values: { resolution: "720p", duration_s: 8 }, impacts: gwpOnly(8) },
    { values: { resolution: "720p", duration_s: 10 }, impacts: gwpOnly(10) },
    { values: { resolution: "1080p", duration_s: 5 }, impacts: gwpOnly(15) },
    { values: { resolution: "1080p", duration_s: 8 }, impacts: gwpOnly(18) },
    { values: { resolution: "1080p", duration_s: 10 }, impacts: gwpOnly(20) },
  ],
};

describe("resolveParameters", () => {
  it("uses the defaults when nothing was chosen", () => {
    expect(resolveParameters(VIDEO_PROFILE, {})).toEqual({
      resolution: "720p",
      duration_s: 8,
    });
  });

  it("keeps supported choices and falls back to the default otherwise", () => {
    // 12 s is not offered by this model: back to the default duration.
    expect(
      resolveParameters(VIDEO_PROFILE, { resolution: "1080p", duration_s: 12 }),
    ).toEqual({ resolution: "1080p", duration_s: 8 });
  });

  it("ignores choices for parameters the profile does not have", () => {
    expect(resolveParameters(VIDEO_PROFILE, { with_audio: false })).toEqual({
      resolution: "720p",
      duration_s: 8,
    });
  });

  it("returns no values for a profile without parameters", () => {
    expect(resolveParameters({ id: "eco", impacts: gwpOnly(1) }, { a: 1 })).toEqual({});
  });
});

describe("resolveImpacts", () => {
  it("returns the impacts of the variant matching the chosen values", () => {
    expect(
      resolveImpacts(VIDEO_PROFILE, { resolution: "1080p", duration_s: 10 }),
    ).toEqual(gwpOnly(20));
  });

  it("returns the default impacts when nothing was chosen", () => {
    expect(resolveImpacts(VIDEO_PROFILE, {})).toEqual(gwpOnly(8));
  });

  it("returns the profile impacts for a profile without variants", () => {
    expect(resolveImpacts({ id: "eco", impacts: gwpOnly(1) }, {})).toEqual(
      gwpOnly(1),
    );
  });
});

describe("computeAnnualEntries with parameters", () => {
  it("uses the variant matching the card's chosen parameters", () => {
    const useCase: UseCase = {
      id: "video",
      providers: [{ providerId: "google", profiles: [VIDEO_PROFILE] }],
    };
    const entries = computeAnnualEntries(
      [useCase],
      {
        video: {
          providerId: "google",
          profileId: "video",
          frequencyPerDay: 1,
          parameters: { resolution: "1080p", duration_s: 5 },
        },
      },
      ["google"],
      10,
    );
    expect(entries).toEqual([{ providerId: "google", impacts: gwpOnly(150) }]);
  });
});
