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

/** A setting the user can change for a profile (e.g. video resolution). */
export interface ProfileParameter {
  id: string;
  options: ParameterValue[];
  defaultValue: ParameterValue;
}

/** Precomputed impacts for one combination of parameter values. */
export interface ProfileVariant {
  values: Record<string, ParameterValue>;
  impacts: Impacts;
}

export interface Profile {
  id: string;
  /** Impacts of the default parameter values. */
  impacts: Impacts;
  parameters?: ProfileParameter[];
  variants?: ProfileVariant[];
  /** Display names of the model(s) behind the profile, when known. */
  models?: string[];
  /** Generated tokens per action assumed for text profiles. */
  outputTokens?: number | null;
}

export interface ProviderMapping {
  providerId: string;
  profiles: Profile[];
}

export interface UseCase {
  id: string;
  subtitleKey?: string;
  defaultProviderId?: string;
  recommendedProfileId?: string;
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
    subtitle_key?: string;
    default_provider?: string;
    recommended_tier?: string;
    providers: Array<{
      provider_id: string;
      profiles: Array<{
        id: string;
        impacts: Impacts;
        parameters?: Array<{
          id: string;
          options: ParameterValue[];
          default: ParameterValue;
        }>;
        variants?: ProfileVariant[];
        models?: string[];
        output_tokens?: number | null;
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
    useCases: body.use_cases.map((uc) => ({
      id: uc.id,
      subtitleKey: uc.subtitle_key,
      defaultProviderId: uc.default_provider,
      recommendedProfileId: uc.recommended_tier,
      providers: uc.providers.map((pm) => ({
        providerId: pm.provider_id,
        profiles: pm.profiles.map((p) => ({
          id: p.id,
          impacts: p.impacts,
          parameters: (p.parameters ?? []).map((param) => ({
            id: param.id,
            options: param.options,
            defaultValue: param.default,
          })),
          variants: p.variants ?? [],
          models: p.models ?? [],
          outputTokens: p.output_tokens ?? null,
        })),
      })),
    })),
  };
}
