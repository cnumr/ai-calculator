import { describe, expect, it } from "vitest";
import type { CalculateRequest, CalculateResult, Impacts, UseCase } from "../src/api/client";
import { buildExportFile, exportFileName } from "../src/domain/exportFile";

const ZERO = { min: 0, max: 0, value: 0 };
const gwp = (kg: number): Impacts => ({ gwp: { min: kg, max: kg, value: kg }, energy: ZERO, adpe: ZERO, pe: null, water: ZERO });

const USE_CASES: UseCase[] = [
  {
    id: "email",
    kind: "text",
    providers: [{ providerId: "openai", profiles: [{ id: "eco", models: ["GPT-5 mini"] }] }],
  },
  {
    id: "video",
    kind: "video",
    providers: [{ providerId: "google", profiles: [{ id: "video" }] }],
  },
];

const REQUEST: CalculateRequest = {
  headcount: 10,
  usages: [
    {
      kind: "text",
      useCaseId: "email",
      providerId: "openai",
      profileId: "eco",
      frequency: 3,
      frequencyUnit: "week",
      parameters: { output_tokens: 500 },
    },
    {
      kind: "video",
      useCaseId: "video",
      providerId: "google",
      profileId: "video",
      frequency: 0,
      frequencyUnit: "day",
      parameters: { resolution: "720p" },
    },
  ],
};

const usageResult = (useCaseId: string, providerId: string, profileId: string, frequency: number) => ({
  useCaseId,
  providerId,
  profileId,
  frequency,
  frequencyUnit: "week" as const,
  frequencyPerDay: frequency / 5,
  parameters: {},
  unitImpacts: gwp(1),
  dailyImpacts: gwp(0.6),
  annualImpacts: gwp(130.8),
});

const RESULT: CalculateResult = {
  meta: {
    appVersion: "0.4.0",
    dataSources: [
      { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrievedOn: null, url: "https://ecologits.ai/" },
      { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrievedOn: "2026-11-08", url: "https://impactco2.fr/" },
    ],
  },
  workingDaysPerYear: 218,
  usages: [usageResult("email", "openai", "eco", 3), usageResult("video", "google", "video", 0)],
  individualAnnual: gwp(130.8),
  enterpriseAnnual: gwp(1308),
  providerBreakdown: [{ providerId: "openai", annualImpacts: gwp(130.8), gwpSharePercent: 100 }],
  co2Equivalents: [{ id: "car_km", impactCo2Slug: "voiturethermique", quantity: 921 }],
};

const build = () =>
  buildExportFile({
    request: REQUEST,
    result: RESULT,
    selectedProviders: new Set(["openai", "google"]),
    useCases: USE_CASES,
    language: "fr",
    exportedAt: new Date("2026-11-25T18:42:07Z"),
  });

describe("buildExportFile", () => {
  it("names the format, the export date and the versions behind the results", () => {
    const file = build();

    expect(file).toMatchObject({
      format: "ai-calculator-export",
      format_version: 1,
      exported_at: "2026-11-25T18:42:07.000Z",
      app_version: "0.4.0",
      language: "fr",
      units: { gwp: "kgCO2eq", energy: "kWh", adpe: "kgSbeq", pe: "MJ", water: "L" },
    });
    expect(file.data_sources).toEqual([
      { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrieved_on: null, url: "https://ecologits.ai/" },
      { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrieved_on: "2026-11-08", url: "https://impactco2.fr/" },
    ]);
  });

  it("keeps the inputs of the used use cases, in the API format, with their models", () => {
    const { input } = build();

    expect(input).toEqual({
      selected_providers: ["openai", "google"],
      headcount: 10,
      usages: [
        {
          kind: "text",
          use_case_id: "email",
          provider_id: "openai",
          profile_id: "eco",
          models: ["GPT-5 mini"],
          frequency: 3,
          frequency_unit: "week",
          parameters: { output_tokens: 500 },
        },
      ],
    });
  });

  it("keeps the results per used use case, per person and per company", () => {
    const { result } = build();

    expect(result.working_days_per_year).toBe(218);
    expect(result.usages).toEqual([
      {
        use_case_id: "email",
        provider_id: "openai",
        profile_id: "eco",
        frequency: 3,
        frequency_unit: "week",
        frequency_per_day: 0.6,
        parameters: {},
        unit_impacts: gwp(1),
        daily_impacts: gwp(0.6),
        annual_impacts: gwp(130.8),
      },
    ]);
    expect(result.individual_annual).toEqual(gwp(130.8));
    expect(result.enterprise_annual).toEqual(gwp(1308));
    expect(result.provider_breakdown).toEqual([
      { provider_id: "openai", annual_impacts: gwp(130.8), gwp_share_percent: 100 },
    ]);
    expect(result.co2_equivalents).toEqual([
      { id: "car_km", impact_co2_slug: "voiturethermique", quantity: 921 },
    ]);
  });
});

describe("exportFileName", () => {
  it("dates the file with the local day", () => {
    expect(exportFileName(new Date(2026, 10, 5, 23, 30))).toBe("ai-calculator-2026-11-05.json");
  });
});
