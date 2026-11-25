import { describe, expect, it } from "vitest";
import type { CalculationMeta, DataSource, UseCase } from "../src/api/client";
import type { CardState } from "../src/domain/calculator";
import { ImportFileError, readExportFile } from "../src/domain/importFile";

const USE_CASES: UseCase[] = [
  {
    id: "email",
    kind: "text",
    defaultProviderId: "google",
    recommendedProfileId: "eco",
    providers: [
      { providerId: "openai", profiles: [{ id: "eco" }, { id: "powerful" }] },
      { providerId: "google", profiles: [{ id: "eco" }] },
    ],
  },
  {
    id: "video",
    kind: "video",
    providers: [{ providerId: "google", profiles: [{ id: "video" }] }],
  },
];
const CATALOG = {
  providers: [
    { id: "openai", selectedByDefault: true },
    { id: "google", selectedByDefault: true },
    { id: "mistralai", selectedByDefault: false },
  ],
  useCases: USE_CASES,
};
const INITIAL: Record<string, CardState> = {
  email: { providerId: "google", profileId: "eco", frequency: 0, frequencyUnit: "day", parameters: {} },
  video: { providerId: "google", profileId: "video", frequency: 0, frequencyUnit: "day", parameters: {} },
};
const SOURCES: DataSource[] = [
  { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrievedOn: null, url: "https://ecologits.ai/" },
  { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrievedOn: "2026-11-08", url: "https://impactco2.fr/" },
];
const CURRENT: CalculationMeta = { appVersion: "0.4.0", dataSources: SOURCES };

function exportFile(overrides: Record<string, unknown> = {}, input: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: "ai-calculator-export",
    format_version: 1,
    exported_at: "2026-11-25T18:42:07.000Z",
    app_version: "0.4.0",
    language: "fr",
    data_sources: [
      { id: "ecologits", name: "EcoLogits", version: "0.11.3", retrieved_on: null, url: "https://ecologits.ai/" },
      { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrieved_on: "2026-11-08", url: "https://impactco2.fr/" },
    ],
    input: {
      selected_providers: ["openai"],
      headcount: 250,
      usages: [
        {
          kind: "text",
          use_case_id: "email",
          provider_id: "openai",
          profile_id: "powerful",
          models: ["GPT-5"],
          frequency: 3,
          frequency_unit: "week",
          parameters: { output_tokens: 500 },
        },
      ],
      ...input,
    },
    result: {},
    ...overrides,
  });
}

const read = (text: string) => readExportFile(text, CATALOG, INITIAL);

describe("readExportFile", () => {
  it("restores the providers, the headcount and the inputs of each use case", () => {
    const imported = read(exportFile());

    expect([...imported.selectedProviders]).toEqual(["openai"]);
    expect(imported.headcount).toBe(250);
    expect(imported.cardStates.email).toEqual({
      providerId: "openai",
      profileId: "powerful",
      frequency: 3,
      frequencyUnit: "week",
      parameters: { output_tokens: 500 },
    });
    // A use case absent from the file starts again from its defaults.
    expect(imported.cardStates.video).toEqual(INITIAL.video);
    expect(imported.importedUseCaseIds).toEqual(["email"]);
    expect(imported.ignoredUseCaseIds).toEqual([]);
    expect(imported.adjustedUseCaseIds).toEqual([]);
    expect(imported.versionChanges(CURRENT)).toEqual([]);
  });

  it("ignores a use case the catalogue no longer has", () => {
    const imported = read(
      exportFile({}, {
        usages: [{ kind: "text", use_case_id: "fax", provider_id: "openai", profile_id: "eco", frequency: 1 }],
      }),
    );

    expect(imported.ignoredUseCaseIds).toEqual(["fax"]);
    expect(imported.importedUseCaseIds).toEqual([]);
  });

  it("falls back to the default provider and recommended profile when they are no longer offered", () => {
    const imported = read(
      exportFile({}, {
        usages: [
          { kind: "text", use_case_id: "email", provider_id: "anthropic", profile_id: "eco", frequency: 2, frequency_unit: "day" },
        ],
      }),
    );

    expect(imported.cardStates.email).toMatchObject({ providerId: "google", profileId: "eco", frequency: 2 });
    expect(imported.adjustedUseCaseIds).toEqual(["email"]);
    // The provider of a restored use case is selected, so that it is calculated.
    expect([...imported.selectedProviders].sort()).toEqual(["google", "openai"]);
  });

  it("falls back to safe values for out-of-range inputs", () => {
    const imported = read(
      exportFile({}, {
        selected_providers: ["unknown"],
        headcount: -3,
        usages: [
          { use_case_id: "video", provider_id: "google", profile_id: "video", frequency: -1, frequency_unit: "year", parameters: "720p" },
        ],
      }),
    );

    expect(imported.headcount).toBe(1000);
    expect(imported.cardStates.video).toEqual({ ...INITIAL.video, frequency: 0 });
    expect([...imported.selectedProviders]).toEqual(["google"]);
  });

  it("lists the versions that differ from those of the recalculation", () => {
    const imported = read(
      exportFile({
        app_version: "0.3.1",
        data_sources: [
          { id: "ecologits", name: "EcoLogits", version: "0.10.0", retrieved_on: null },
          { id: "impactco2", name: "ImpactCO2 (ADEME)", version: null, retrieved_on: "2026-11-08" },
        ],
      }),
    );

    expect(imported.versionChanges(CURRENT)).toEqual([
      { name: "AI Calculator", from: "0.3.1", to: "0.4.0" },
      { name: "EcoLogits", from: "0.10.0", to: "0.11.3" },
    ]);
  });

  it.each([
    ["not JSON", "{", "unreadable"],
    ["another JSON file", JSON.stringify({ hello: "world" }), "notAnExport"],
    ["an export without inputs", exportFile({ input: null }), "notAnExport"],
    ["a newer format", exportFile({ format_version: 2 }), "newerFormat"],
  ])("rejects %s", (_label, text, code) => {
    expect(() => read(text)).toThrow(ImportFileError);
    try {
      read(text);
    } catch (error) {
      expect((error as ImportFileError).code).toBe(code);
    }
  });
});
