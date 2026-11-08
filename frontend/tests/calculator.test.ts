import { describe, expect, it } from "vitest";
import type { Profile, UsageRequest, UsageResult, UseCase } from "../src/api/client";
import {
  CardState,
  buildCalculateRequest,
  isUsageResultCurrent,
  resolveParameters,
  resolveSelection,
} from "../src/domain/calculator";

const VIDEO_PROFILE: Profile = {
  id: "video",
  parameters: [
    { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p", min: null, max: null },
    { id: "duration_s", options: [5, 8, 10], defaultValue: 8, min: null, max: null },
  ],
};

// video is only offered by google; email falls back to openai without google.
const VIDEO: UseCase = {
  id: "video",
  kind: "video",
  providers: [{ providerId: "google", profiles: [VIDEO_PROFILE] }],
};

const EMAIL: UseCase = {
  id: "email",
  kind: "text",
  providers: [
    { providerId: "openai", profiles: [{ id: "eco" }, { id: "powerful" }] },
    { providerId: "google", profiles: [{ id: "eco" }] },
  ],
};

const state = (overrides: Partial<CardState> = {}): CardState => ({
  providerId: "google",
  profileId: "eco",
  frequencyPerDay: 1,
  parameters: {},
  ...overrides,
});

describe("resolveSelection", () => {
  it("keeps the stored provider and profile when still offered", () => {
    const { mapping, profile } = resolveSelection(
      EMAIL,
      ["openai", "google"],
      state({ providerId: "openai", profileId: "powerful" }),
    );
    expect(mapping?.providerId).toBe("openai");
    expect(profile?.id).toBe("powerful");
  });

  it("falls back to the first offered provider and profile", () => {
    const { mapping, profile } = resolveSelection(
      EMAIL,
      ["openai"],
      state({ providerId: "google", profileId: "missing" }),
    );
    expect(mapping?.providerId).toBe("openai");
    expect(profile?.id).toBe("eco");
  });

  it("resolves nothing when no selected provider offers the use case", () => {
    const { offeredProviders, mapping, profile } = resolveSelection(
      VIDEO,
      ["openai"],
      state({ profileId: "video" }),
    );
    expect(offeredProviders).toEqual([]);
    expect(mapping).toBeUndefined();
    expect(profile).toBeUndefined();
  });
});

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
    expect(resolveParameters({ id: "eco" }, { a: 1 })).toEqual({});
  });
});

describe("resolveParameters with a free integer", () => {
  const TOKENS: Profile = {
    id: "eco",
    parameters: [{ id: "output_tokens", defaultValue: 300, options: null, min: 1, max: 1000 }],
  };

  it("keeps a valid integer", () => {
    expect(resolveParameters(TOKENS, { output_tokens: 750 })).toEqual({ output_tokens: 750 });
  });

  it.each([[""], [0], [1001], [12.5], ["750"]])(
    "falls back to the default for %j (empty, out of range or not an integer)",
    (value) => {
      expect(resolveParameters(TOKENS, { output_tokens: value })).toEqual({ output_tokens: 300 });
    },
  );
});

describe("buildCalculateRequest", () => {
  const states = {
    video: state({ profileId: "video", parameters: { resolution: "1080p" } }),
    email: state({ frequencyPerDay: 3 }),
  };

  it("sends one usage per card, with its kind and frequency", () => {
    const request = buildCalculateRequest([VIDEO, EMAIL], states, ["openai", "google"], 50);

    expect(request).toEqual({
      headcount: 50,
      usages: [
        {
          kind: "video",
          useCaseId: "video",
          providerId: "google",
          profileId: "video",
          frequencyPerDay: 1,
          parameters: { resolution: "1080p", duration_s: 8 },
        },
        {
          kind: "text",
          useCaseId: "email",
          providerId: "google",
          profileId: "eco",
          frequencyPerDay: 3,
          parameters: {},
        },
      ],
    });
  });

  it("drops cards that no selected provider offers", () => {
    const request = buildCalculateRequest([VIDEO, EMAIL], states, ["openai"], 1);

    expect(request.usages.map((u) => u.useCaseId)).toEqual(["email"]);
  });

  it("sends the provider a card falls back to", () => {
    const request = buildCalculateRequest([VIDEO, EMAIL], states, ["openai"], 1);

    expect(request.usages[0]).toMatchObject({ providerId: "openai", profileId: "eco" });
  });

  it("ignores use cases without a card state", () => {
    expect(buildCalculateRequest([VIDEO], {}, ["google"], 1).usages).toEqual([]);
  });

  it("is identical for identical card states (a reset sends the same scenario)", () => {
    const first = buildCalculateRequest([VIDEO, EMAIL], states, ["google"], 1);
    const again = buildCalculateRequest(
      [VIDEO, EMAIL],
      structuredClone(states),
      ["google"],
      1,
    );

    expect(again).toEqual(first);
  });

  it.each([
    [0, 1],
    [Number.NaN, 1],
    [12.7, 12],
  ])("sends a valid headcount (%s -> %s)", (headcount, expected) => {
    expect(buildCalculateRequest([], {}, [], headcount).headcount).toBe(expected);
  });

  it("never sends a negative or invalid frequency", () => {
    const request = buildCalculateRequest(
      [EMAIL],
      { email: state({ frequencyPerDay: Number.NaN }) },
      ["google"],
      1,
    );

    expect(request.usages[0].frequencyPerDay).toBe(0);
  });
});

describe("isUsageResultCurrent", () => {
  const usage: UsageRequest = {
    kind: "video",
    useCaseId: "video",
    providerId: "google",
    profileId: "video",
    frequencyPerDay: 2,
    parameters: { resolution: "1080p" },
  };
  const ZERO = { min: 0, max: 0 };
  const impacts = { gwp: ZERO, energy: ZERO, adpe: ZERO, pe: ZERO, water: ZERO };
  const result: UsageResult = {
    useCaseId: "video",
    providerId: "google",
    profileId: "video",
    frequencyPerDay: 2,
    parameters: { resolution: "1080p", duration_s: 8 },
    unitImpacts: impacts,
    dailyImpacts: impacts,
    annualImpacts: impacts,
  };

  it("is current when the selection, frequency and parameters match", () => {
    expect(isUsageResultCurrent(usage, result)).toBe(true);
  });

  it.each([
    ["provider", { providerId: "openai" }],
    ["profile", { profileId: "video_fast" }],
    ["frequency", { frequencyPerDay: 3 }],
    ["parameter", { parameters: { resolution: "720p" } }],
  ])("is stale when the %s changed", (_, change) => {
    expect(isUsageResultCurrent({ ...usage, ...change }, result)).toBe(false);
  });
});
