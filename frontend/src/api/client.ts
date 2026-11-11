// frontend/src/api/client.ts
export interface ProviderModel {
  provider: string;
  name: string;
}

export interface ImpactRange {
  min: number;
  max: number;
}

export interface Impacts {
  gwp: ImpactRange | null;
  energy: ImpactRange | null;
  adpe: ImpactRange | null;
  pe: ImpactRange | null;
  water: ImpactRange | null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchProviders(): Promise<ProviderModel[]> {
  const response = await fetch(`${API_BASE}/api/providers`);
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch providers");
  }
  return response.json();
}

export interface CatalogProvider {
  id: string;
  selectedByDefault: boolean;
}

export type ParameterValue = string | number | boolean;

/** How a use case's impacts are computed, and which parameters it accepts. */
export type UseCaseKind = "text" | "video" | "image";

/**
 * A setting the user can change for a profile: a choice among `options`
 * (e.g. video resolution), or a free integer in [min, max] when `options`
 * is null (e.g. generated tokens).
 */
export interface ProfileParameter {
  id: string;
  defaultValue: ParameterValue;
  options: ParameterValue[] | null;
  min: number | null;
  max: number | null;
}

export interface Profile {
  id: string;
  parameters?: ProfileParameter[];
  /** Display names of the model(s) behind the profile, when known. */
  models?: string[];
}

export interface ProviderMapping {
  providerId: string;
  profiles: Profile[];
}

/** Methodological source behind a use case's impacts. */
export interface MethodologicalSource {
  /** "ecologits_llm", "ecologits_video" or "image_from_video". */
  id: string;
  version: string | null;
  url: string | null;
}

export interface UseCase {
  id: string;
  kind: UseCaseKind;
  source?: MethodologicalSource;
  subtitleKey?: string;
  defaultProviderId?: string;
  recommendedProfileId?: string;
  /** Family the use case is listed under (e.g. "writing"). */
  family?: string | null;
  providers: ProviderMapping[];
}

/** An external data source behind the calculations (shown in the footer). */
export interface DataSource {
  id: string;
  name: string;
  /** Library version, e.g. EcoLogits. */
  version: string | null;
  /** Date the dataset was copied (YYYY-MM-DD), e.g. ImpactCO2. */
  retrievedOn: string | null;
  url: string;
}

export interface UseCasesCatalog {
  providers: CatalogProvider[];
  /** Families of use cases, in display order. */
  families?: string[];
  useCases: UseCase[];
  dataSources?: DataSource[];
}

interface UseCasesResponseBody {
  providers: Array<{ id: string; selected_by_default: boolean }>;
  families?: Array<{ id: string }>;
  data_sources?: Array<{
    id: string;
    name: string;
    version: string | null;
    retrieved_on: string | null;
    url: string;
  }>;
  use_cases: Array<{
    id: string;
    kind: UseCaseKind;
    source?: MethodologicalSource;
    subtitle_key?: string;
    default_provider?: string;
    recommended_tier?: string;
    family?: string | null;
    providers: Array<{
      provider_id: string;
      profiles: Array<{
        id: string;
        parameters?: Array<{
          id: string;
          default: ParameterValue;
          options: ParameterValue[] | null;
          min: number | null;
          max: number | null;
        }>;
        models?: string[];
      }>;
    }>;
  }>;
}

export async function fetchUseCases(): Promise<UseCasesCatalog> {
  const response = await fetch(`${API_BASE}/api/use-cases`);
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch use cases");
  }
  const body: UseCasesResponseBody = await response.json();
  return {
    providers: body.providers.map((p) => ({
      id: p.id,
      selectedByDefault: p.selected_by_default,
    })),
    families: (body.families ?? []).map((f) => f.id),
    dataSources: (body.data_sources ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      retrievedOn: s.retrieved_on,
      url: s.url,
    })),
    useCases: body.use_cases.map((uc) => ({
      id: uc.id,
      kind: uc.kind,
      source: uc.source,
      subtitleKey: uc.subtitle_key,
      defaultProviderId: uc.default_provider,
      recommendedProfileId: uc.recommended_tier,
      family: uc.family ?? null,
      providers: uc.providers.map((pm) => ({
        providerId: pm.provider_id,
        profiles: pm.profiles.map((p) => ({
          id: p.id,
          parameters: (p.parameters ?? []).map((param) => ({
            id: param.id,
            defaultValue: param.default,
            options: param.options,
            min: param.min,
            max: param.max,
          })),
          models: p.models ?? [],
        })),
      })),
    })),
  };
}

/* ------------------------------------------------------------------------ */
/* POST /api/calculate                                                       */
/* ------------------------------------------------------------------------ */

/** Period of a usage frequency: working day, week or month. */
export type FrequencyUnit = "day" | "week" | "month";

export const FREQUENCY_UNITS: FrequencyUnit[] = ["day", "week", "month"];

/** One usage of a use case, as sent to the calculation. */
export interface UsageRequest {
  kind: UseCaseKind;
  useCaseId: string;
  providerId: string;
  profileId: string;
  /** Average actions per `frequencyUnit`. */
  frequency: number;
  frequencyUnit: FrequencyUnit;
  /** Parameter values (tokens, video settings, image size). */
  parameters?: Record<string, ParameterValue>;
}

export interface CalculateRequest {
  usages: UsageRequest[];
  headcount: number;
}

export interface UsageResult {
  useCaseId: string;
  providerId: string;
  profileId: string;
  frequency: number;
  frequencyUnit: FrequencyUnit;
  /** Equivalent per working day, converted by the backend. */
  frequencyPerDay: number;
  /** Parameter values actually used (defaults filled in). */
  parameters: Record<string, ParameterValue>;
  unitImpacts: Impacts;
  dailyImpacts: Impacts;
  annualImpacts: Impacts;
}

export interface ProviderShare {
  providerId: string;
  annualImpacts: Impacts;
  gwpSharePercent: number;
}

export interface Co2EquivalentQuantity {
  id: string;
  impactCo2Slug: string;
  /** Raw quantity: rounding is up to the display. */
  quantity: number;
}

export interface CalculateResult {
  workingDaysPerYear: number;
  usages: UsageResult[];
  individualAnnual: Impacts;
  enterpriseAnnual: Impacts;
  providerBreakdown: ProviderShare[];
  co2Equivalents: Co2EquivalentQuantity[];
}

interface CalculateResponseBody {
  working_days_per_year: number;
  usages: Array<{
    use_case_id: string;
    provider_id: string;
    profile_id: string;
    frequency: number;
    frequency_unit: FrequencyUnit;
    frequency_per_day: number;
    parameters: Record<string, ParameterValue>;
    unit_impacts: Impacts;
    daily_impacts: Impacts;
    annual_impacts: Impacts;
  }>;
  individual_annual: Impacts;
  enterprise_annual: Impacts;
  provider_breakdown: Array<{
    provider_id: string;
    annual_impacts: Impacts;
    gwp_share_percent: number;
  }>;
  co2_equivalents: Array<{ id: string; impact_co2_slug: string; quantity: number }>;
}

export async function calculate(
  request: CalculateRequest,
  signal?: AbortSignal,
): Promise<CalculateResult> {
  const response = await fetch(`${API_BASE}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      headcount: request.headcount,
      usages: request.usages.map((u) => ({
        kind: u.kind,
        use_case_id: u.useCaseId,
        provider_id: u.providerId,
        profile_id: u.profileId,
        frequency: u.frequency,
        frequency_unit: u.frequencyUnit,
        parameters: u.parameters ?? {},
      })),
    }),
    signal,
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to calculate impacts");
  }
  const body: CalculateResponseBody = await response.json();
  return {
    workingDaysPerYear: body.working_days_per_year,
    usages: body.usages.map((u) => ({
      useCaseId: u.use_case_id,
      providerId: u.provider_id,
      profileId: u.profile_id,
      frequency: u.frequency,
      frequencyUnit: u.frequency_unit,
      frequencyPerDay: u.frequency_per_day,
      parameters: u.parameters,
      unitImpacts: u.unit_impacts,
      dailyImpacts: u.daily_impacts,
      annualImpacts: u.annual_impacts,
    })),
    individualAnnual: body.individual_annual,
    enterpriseAnnual: body.enterprise_annual,
    providerBreakdown: body.provider_breakdown.map((s) => ({
      providerId: s.provider_id,
      annualImpacts: s.annual_impacts,
      gwpSharePercent: s.gwp_share_percent,
    })),
    co2Equivalents: body.co2_equivalents.map((e) => ({
      id: e.id,
      impactCo2Slug: e.impact_co2_slug,
      quantity: e.quantity,
    })),
  };
}
