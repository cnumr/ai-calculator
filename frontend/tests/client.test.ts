import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, calculate, fetchUseCases } from "../src/api/client";

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUseCases", () => {
  it("converts the catalogue to camelCase, with kinds and profile details", async () => {
    stubFetch({
      providers: [{ id: "google", selected_by_default: true }],
      data_sources: [
        { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrieved_on: null, url: "https://ecologits.ai/" },
      ],
      use_cases: [
        {
          id: "video",
          kind: "video",
          source: {
            id: "ecologits_video",
            version: "0.11.3",
            url: "https://ecologits.ai/latest/methodology/video_generation/",
          },
          default_provider: "google",
          recommended_tier: "video",
          providers: [
            {
              provider_id: "google",
              profiles: [
                {
                  id: "video",
                  parameters: [
                    { id: "resolution", default: "720p", options: ["720p", "1080p"], min: null, max: null },
                  ],
                  models: ["Veo 3"],
                },
                { id: "legacy" },
              ],
            },
          ],
        },
      ],
    });

    const catalog = await fetchUseCases();

    expect(catalog.providers).toEqual([{ id: "google", selectedByDefault: true }]);
    expect(catalog.dataSources).toEqual([
      { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrievedOn: null, url: "https://ecologits.ai/" },
    ]);
    expect(catalog.useCases[0]).toMatchObject({
      id: "video",
      kind: "video",
      source: {
        id: "ecologits_video",
        version: "0.11.3",
        url: "https://ecologits.ai/latest/methodology/video_generation/",
      },
      defaultProviderId: "google",
      recommendedProfileId: "video",
    });
    const [video, legacy] = catalog.useCases[0].providers[0].profiles;
    expect(video).toEqual({
      id: "video",
      parameters: [
        { id: "resolution", defaultValue: "720p", options: ["720p", "1080p"], min: null, max: null },
      ],
      models: ["Veo 3"],
    });
    expect(legacy).toEqual({ id: "legacy", parameters: [], models: [] });
  });

  it("throws ApiError when the response is not ok", async () => {
    stubFetch({}, false, 500);

    await expect(fetchUseCases()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("calculate", () => {
  const ZERO = { min: 0, max: 0 };
  const impacts = { gwp: { min: 1, max: 2 }, energy: ZERO, adpe: ZERO, pe: null, water: ZERO };
  const response = {
    working_days_per_year: 218,
    usages: [
      {
        use_case_id: "video",
        provider_id: "google",
        profile_id: "video",
        frequency_per_day: 1,
        parameters: { resolution: "1080p", duration_s: 8, with_audio: true },
        unit_impacts: impacts,
        daily_impacts: impacts,
        annual_impacts: impacts,
      },
    ],
    individual_annual: impacts,
    enterprise_annual: impacts,
    provider_breakdown: [
      { provider_id: "google", annual_impacts: impacts, gwp_share_percent: 100 },
    ],
    co2_equivalents: [{ id: "car_km", impact_co2_slug: "voiturethermique", quantity: 7.5 }],
  };

  it("posts the scenario in snake_case, with the parameters of each usage", async () => {
    const fetchMock = stubFetch(response);
    const controller = new AbortController();

    await calculate(
      {
        headcount: 10,
        usages: [
          {
            kind: "video",
            useCaseId: "video",
            providerId: "google",
            profileId: "video",
            frequencyPerDay: 1,
            parameters: { resolution: "1080p" },
          },
          {
            kind: "text",
            useCaseId: "email",
            providerId: "openai",
            profileId: "eco",
            frequencyPerDay: 3,
            parameters: { output_tokens: 500 },
          },
          {
            kind: "image",
            useCaseId: "image",
            providerId: "google",
            profileId: "image",
            frequencyPerDay: 2,
            parameters: { size: "2048x2048" },
          },
        ],
      },
      controller.signal,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/calculate");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(init.body)).toEqual({
      headcount: 10,
      usages: [
        {
          kind: "video",
          use_case_id: "video",
          provider_id: "google",
          profile_id: "video",
          frequency_per_day: 1,
          parameters: { resolution: "1080p" },
        },
        {
          kind: "text",
          use_case_id: "email",
          provider_id: "openai",
          profile_id: "eco",
          frequency_per_day: 3,
          parameters: { output_tokens: 500 },
        },
        {
          kind: "image",
          use_case_id: "image",
          provider_id: "google",
          profile_id: "image",
          frequency_per_day: 2,
          parameters: { size: "2048x2048" },
        },
      ],
    });
  });

  it("converts the result to camelCase", async () => {
    stubFetch(response);

    const result = await calculate({ headcount: 1, usages: [] });

    expect(result.workingDaysPerYear).toBe(218);
    expect(result.usages[0]).toMatchObject({
      useCaseId: "video",
      providerId: "google",
      profileId: "video",
      frequencyPerDay: 1,
      parameters: { resolution: "1080p", duration_s: 8, with_audio: true },
      dailyImpacts: impacts,
    });
    expect(result.providerBreakdown).toEqual([
      { providerId: "google", annualImpacts: impacts, gwpSharePercent: 100 },
    ]);
    expect(result.co2Equivalents).toEqual([
      { id: "car_km", impactCo2Slug: "voiturethermique", quantity: 7.5 },
    ]);
  });

  it("throws ApiError when the calculation is rejected", async () => {
    stubFetch({ detail: "resolution '4k' is not supported" }, false, 422);

    await expect(calculate({ headcount: 1, usages: [] })).rejects.toMatchObject({
      status: 422,
    });
  });
});
