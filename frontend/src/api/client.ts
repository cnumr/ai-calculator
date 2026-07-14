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
  gwp: ImpactRange;
  energy: ImpactRange;
  adpe: ImpactRange;
  pe: ImpactRange;
  water: ImpactRange;
}

export interface CalculateResult {
  unit: Impacts;
  individualAnnual: Impacts;
  enterpriseAnnual: Impacts;
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

interface CalculateParams {
  provider: string;
  model: string;
  outputTokens: number;
  requestsPerDay: number;
  workingDaysPerYear?: number;
  headcount?: number;
}

interface CalculateResponseBody {
  unit: Impacts;
  individual_annual: Impacts;
  enterprise_annual: Impacts;
}

export async function calculate(
  params: CalculateParams,
): Promise<CalculateResult> {
  const response = await fetch(`${API_BASE}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: params.provider,
      model: params.model,
      output_tokens: params.outputTokens,
      requests_per_day: params.requestsPerDay,
      working_days_per_year: params.workingDaysPerYear ?? 220,
      headcount: params.headcount ?? 1,
    }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to compute impacts");
  }
  const body: CalculateResponseBody = await response.json();
  return {
    unit: body.unit,
    individualAnnual: body.individual_annual,
    enterpriseAnnual: body.enterprise_annual,
  };
}

export interface CatalogProvider {
  id: string;
  selectedByDefault: boolean;
}

export interface Profile {
  id: string;
  impacts: Impacts;
}

export interface ProviderMapping {
  providerId: string;
  profiles: Profile[];
}

export interface UseCase {
  id: string;
  providers: ProviderMapping[];
}

export interface UseCasesCatalog {
  providers: CatalogProvider[];
  useCases: UseCase[];
}

interface UseCasesResponseBody {
  providers: Array<{ id: string; selected_by_default: boolean }>;
  use_cases: Array<{
    id: string;
    providers: Array<{
      provider_id: string;
      profiles: Array<{ id: string; impacts: Impacts }>;
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
    useCases: body.use_cases.map((uc) => ({
      id: uc.id,
      providers: uc.providers.map((pm) => ({
        providerId: pm.provider_id,
        profiles: pm.profiles.map((p) => ({ id: p.id, impacts: p.impacts })),
      })),
    })),
  };
}
