import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchUseCases } from "../src/api/client";

describe("fetchUseCases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts catalogue defaults and provider fields to camelCase", async () => {
    const body = {
      providers: [{ id: "openai", selected_by_default: true }],
      use_cases: [
        {
          id: "email",
          default_provider: "openai",
          recommended_tier: "eco",
          providers: [
            {
              provider_id: "openai",
              profiles: [
                {
                  id: "eco",
                  impacts: {
                    gwp: { min: 1, max: 2 },
                    energy: { min: 0, max: 0 },
                    adpe: { min: 0, max: 0 },
                    pe: { min: 0, max: 0 },
                    water: { min: 0, max: 0 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      }),
    );

    const catalog = await fetchUseCases();

    expect(catalog.providers).toEqual([
      { id: "openai", selectedByDefault: true },
    ]);
    expect(catalog.useCases[0]).toMatchObject({
      defaultProviderId: "openai",
      recommendedProfileId: "eco",
    });
    expect(catalog.useCases[0].providers[0].providerId).toBe("openai");
    expect(catalog.useCases[0].providers[0].profiles[0].impacts.gwp).toEqual({
      min: 1,
      max: 2,
    });
  });

  it("keeps profile parameters and variants, defaulting to none", async () => {
    const impacts = {
      gwp: { min: 1, max: 2 },
      energy: null,
      adpe: null,
      pe: null,
      water: null,
    };
    const body = {
      providers: [{ id: "google", selected_by_default: true }],
      use_cases: [
        {
          id: "video",
          providers: [
            {
              provider_id: "google",
              profiles: [
                {
                  id: "video",
                  impacts,
                  parameters: [
                    { id: "resolution", options: ["720p", "1080p"], default: "720p" },
                  ],
                  variants: [{ values: { resolution: "1080p" }, impacts }],
                },
                { id: "legacy", impacts },
              ],
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }),
    );

    const [video, legacy] = (await fetchUseCases()).useCases[0].providers[0]
      .profiles;

    expect(video.parameters).toEqual([
      { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p" },
    ]);
    expect(video.variants).toEqual([{ values: { resolution: "1080p" }, impacts }]);
    expect(legacy.parameters).toEqual([]);
    expect(legacy.variants).toEqual([]);
  });

  it("throws ApiError when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchUseCases()).rejects.toBeInstanceOf(ApiError);
  });
});
