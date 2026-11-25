/**
 * Export of the calculator's data as a JSON file (issue #55): the user's
 * inputs and the impacts returned by POST /api/calculate, with the versions
 * behind them, readable by a third-party tool and re-importable later.
 *
 * The file uses the API's snake_case structures: `input` matches the
 * calculation request and `result` its response. Only the used use cases
 * (frequency above 0) are kept. Nothing is computed here: the impacts are
 * the backend's, as returned.
 */
import type {
  CalculateRequest,
  CalculateResult,
  UseCase,
} from "../api/client";

export const EXPORT_FORMAT = "ai-calculator-export";
/** Version of the file structure, independent of the site's: bumped only
 * when the structure changes, so that the import can read older files. */
export const EXPORT_FORMAT_VERSION = 1;

/** Units of the impacts, as returned by the backend. */
const UNITS = { gwp: "kgCO2eq", energy: "kWh", adpe: "kgSbeq", pe: "MJ", water: "L" };

export interface ExportSource {
  request: CalculateRequest;
  result: CalculateResult;
  selectedProviders: Iterable<string>;
  useCases: UseCase[];
  language: string;
  exportedAt: Date;
}

function modelsOf(useCases: UseCase[], useCaseId: string, providerId: string, profileId: string) {
  return (
    useCases
      .find((uc) => uc.id === useCaseId)
      ?.providers.find((pm) => pm.providerId === providerId)
      ?.profiles.find((p) => p.id === profileId)?.models ?? []
  );
}

export function buildExportFile({
  request,
  result,
  selectedProviders,
  useCases,
  language,
  exportedAt,
}: ExportSource) {
  return {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: exportedAt.toISOString(),
    app_version: result.meta.appVersion,
    language,
    data_sources: result.meta.dataSources.map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      retrieved_on: s.retrievedOn,
      url: s.url,
    })),
    units: UNITS,
    input: {
      selected_providers: Array.from(selectedProviders),
      headcount: request.headcount,
      usages: request.usages
        .filter((u) => u.frequency > 0)
        .map((u) => ({
          kind: u.kind,
          use_case_id: u.useCaseId,
          provider_id: u.providerId,
          profile_id: u.profileId,
          // For a reader without the catalogue; not read back by the import.
          models: modelsOf(useCases, u.useCaseId, u.providerId, u.profileId),
          frequency: u.frequency,
          frequency_unit: u.frequencyUnit,
          parameters: u.parameters ?? {},
        })),
    },
    result: {
      working_days_per_year: result.workingDaysPerYear,
      usages: result.usages
        .filter((u) => u.frequency > 0)
        .map((u) => ({
          use_case_id: u.useCaseId,
          provider_id: u.providerId,
          profile_id: u.profileId,
          frequency: u.frequency,
          frequency_unit: u.frequencyUnit,
          frequency_per_day: u.frequencyPerDay,
          parameters: u.parameters,
          unit_impacts: u.unitImpacts,
          daily_impacts: u.dailyImpacts,
          annual_impacts: u.annualImpacts,
        })),
      individual_annual: result.individualAnnual,
      enterprise_annual: result.enterpriseAnnual,
      provider_breakdown: result.providerBreakdown.map((s) => ({
        provider_id: s.providerId,
        annual_impacts: s.annualImpacts,
        gwp_share_percent: s.gwpSharePercent,
      })),
      co2_equivalents: result.co2Equivalents.map((e) => ({
        id: e.id,
        impact_co2_slug: e.impactCo2Slug,
        quantity: e.quantity,
      })),
    },
  };
}

export type ExportFile = ReturnType<typeof buildExportFile>;

/** `ai-calculator-YYYY-MM-DD.json`, dated with the user's local day. */
export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ai-calculator-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Saves the file through the browser: no request is made. */
export function downloadExportFile(file: ExportFile, date: Date): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(date);
  link.click();
  // Released once the browser has started the download: revoking it at once
  // cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
