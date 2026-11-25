/**
 * Import of a file made by the export (issue #55, see exportFile.ts): only
 * the user's inputs are read back. The impacts the file holds are ignored:
 * the page recalculates them with the backend, in one POST /api/calculate.
 *
 * The file is read in the browser and never sent as is. Anything the current
 * catalogue no longer offers is ignored or brought back to a default, and
 * reported, rather than failing the whole import.
 */
import {
  FREQUENCY_UNITS,
  type CalculationMeta,
  type CatalogProvider,
  type FrequencyUnit,
  type ParameterValue,
  type UseCase,
} from "../api/client";
import { DEFAULT_HEADCOUNT, type CardState } from "./calculator";
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from "./exportFile";

/** Far above any real export (a few kB): a larger file is not one. */
export const MAX_IMPORT_BYTES = 1_000_000;

export type ImportErrorCode = "unreadable" | "tooLarge" | "notAnExport" | "newerFormat";

export class ImportFileError extends Error {
  code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(`Cannot import the file: ${code}`);
    this.code = code;
  }
}

/** A version of the file that differs from the one now in use. */
export interface VersionChange {
  name: string;
  from: string;
  to: string;
}

export interface ImportedScenario {
  selectedProviders: Set<string>;
  cardStates: Record<string, CardState>;
  headcount: number;
  /** Use cases restored from the file, in its order. */
  importedUseCaseIds: string[];
  /** Use cases of the file the catalogue no longer has. */
  ignoredUseCaseIds: string[];
  /** Use cases restored with another provider or profile than the file's. */
  adjustedUseCaseIds: string[];
  /**
   * Versions of the file that differ from those which recalculated its
   * impacts: the `meta` of the calculation that follows the import, the same
   * source as the export's.
   */
  versionChanges: (current: CalculationMeta) => VersionChange[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown) => (typeof value === "string" ? value : undefined);
const isParameterValue = (value: unknown): value is ParameterValue =>
  ["string", "number", "boolean"].includes(typeof value);

function parse(text: string): Json {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new ImportFileError("unreadable");
  }
  if (!isObject(file) || file.format !== EXPORT_FORMAT || !isObject(file.input)) {
    throw new ImportFileError("notAnExport");
  }
  if (typeof file.format_version !== "number" || file.format_version > EXPORT_FORMAT_VERSION) {
    throw new ImportFileError("newerFormat");
  }
  return file;
}

function restoreCard(useCase: UseCase, usage: Json, initial: CardState) {
  const mapping = useCase.providers.find((pm) => pm.providerId === usage.provider_id);
  const providerId = mapping?.providerId ?? initial.providerId;
  const profiles =
    (mapping ?? useCase.providers.find((pm) => pm.providerId === providerId))?.profiles ?? [];
  const profile = profiles.find((p) => p.id === usage.profile_id);
  const profileId = profile?.id ?? initial.profileId;

  const frequency =
    typeof usage.frequency === "number" && Number.isFinite(usage.frequency) && usage.frequency > 0
      ? usage.frequency
      : 0;
  const frequencyUnit = FREQUENCY_UNITS.includes(usage.frequency_unit as FrequencyUnit)
    ? (usage.frequency_unit as FrequencyUnit)
    : initial.frequencyUnit;
  // Values the profile does not accept fall back to its defaults when the
  // scenario is built (resolveParameters).
  const parameters: Record<string, ParameterValue> = {};
  if (isObject(usage.parameters)) {
    for (const [id, value] of Object.entries(usage.parameters)) {
      if (isParameterValue(value)) parameters[id] = value;
    }
  }
  const card: CardState = { providerId, profileId, frequency, frequencyUnit, parameters };
  return { card, adjusted: !mapping || !profile };
}

function versionChanges(file: Json, current: CalculationMeta): VersionChange[] {
  const changes: VersionChange[] = [];
  const appVersion = asString(file.app_version);
  if (appVersion && appVersion !== current.appVersion) {
    changes.push({ name: "AI Calculator", from: appVersion, to: current.appVersion });
  }
  const fileSources = Array.isArray(file.data_sources) ? file.data_sources.filter(isObject) : [];
  for (const source of current.dataSources) {
    const before = fileSources.find((s) => s.id === source.id);
    if (!before) continue;
    // A library has a version (EcoLogits), a dataset a retrieval date (ImpactCO2).
    const from = asString(before.version) ?? asString(before.retrieved_on);
    const to = source.version ?? source.retrievedOn;
    if (from && to && from !== to) changes.push({ name: source.name, from, to });
  }
  return changes;
}

export function readExportFile(
  text: string,
  catalog: { providers: CatalogProvider[]; useCases: UseCase[] },
  initialCardStates: Record<string, CardState>,
): ImportedScenario {
  const file = parse(text);
  const input = file.input as Json;

  const cardStates = { ...initialCardStates };
  const importedUseCaseIds: string[] = [];
  const ignoredUseCaseIds: string[] = [];
  const adjustedUseCaseIds: string[] = [];
  const usages = Array.isArray(input.usages) ? input.usages.filter(isObject) : [];
  for (const usage of usages) {
    const id = asString(usage.use_case_id) ?? "?";
    const useCase = catalog.useCases.find((uc) => uc.id === id);
    if (!useCase || !cardStates[id]) {
      ignoredUseCaseIds.push(id);
      continue;
    }
    const { card, adjusted } = restoreCard(useCase, usage, initialCardStates[id]);
    cardStates[id] = card;
    importedUseCaseIds.push(id);
    if (adjusted) adjustedUseCaseIds.push(id);
  }

  const known = new Set(catalog.providers.map((p) => p.id));
  const fileProviders = Array.isArray(input.selected_providers) ? input.selected_providers : [];
  const selectedProviders = new Set(
    fileProviders.filter((id): id is string => typeof id === "string" && known.has(id)),
  );
  // A restored use case is only calculated if its provider is selected.
  for (const id of importedUseCaseIds) selectedProviders.add(cardStates[id].providerId);
  if (selectedProviders.size === 0) {
    catalog.providers.filter((p) => p.selectedByDefault).forEach((p) => selectedProviders.add(p.id));
  }

  const headcount =
    typeof input.headcount === "number" && Number.isInteger(input.headcount) && input.headcount >= 1
      ? input.headcount
      : DEFAULT_HEADCOUNT;

  return {
    selectedProviders,
    cardStates,
    headcount,
    importedUseCaseIds,
    ignoredUseCaseIds,
    adjustedUseCaseIds,
    versionChanges: (current) => versionChanges(file, current),
  };
}
