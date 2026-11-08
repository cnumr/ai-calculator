/**
 * Interface logic of the calculator: which provider, profile and parameter
 * values each card actually uses, and the scenario sent to POST
 * /api/calculate. The impacts themselves are computed by the backend.
 */
import type {
  CalculateRequest,
  ParameterValue,
  Profile,
  ProviderMapping,
  UsageRequest,
  UsageResult,
  UseCase,
} from "../api/client";

export interface CardState {
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
  /**
   * Parameter values chosen by the user (e.g. video resolution). Kept when
   * switching profile, so a choice comes back with a model that supports it.
   */
  parameters: Record<string, ParameterValue>;
}

export interface ResolvedSelection {
  offeredProviders: ProviderMapping[];
  mapping: ProviderMapping | undefined;
  profile: Profile | undefined;
}

/**
 * Resolves the provider and profile a card actually uses, given the
 * providers currently selected in the ecosystem: the stored choice when it
 * is still offered, otherwise the first offered provider/profile.
 */
export function resolveSelection(
  useCase: UseCase,
  availableProviderIds: Iterable<string>,
  state: Pick<CardState, "providerId" | "profileId">,
): ResolvedSelection {
  const available = new Set(availableProviderIds);
  const offeredProviders = useCase.providers.filter((pm) =>
    available.has(pm.providerId),
  );
  const mapping =
    offeredProviders.find((pm) => pm.providerId === state.providerId) ??
    offeredProviders[0];
  const profile =
    mapping?.profiles.find((p) => p.id === state.profileId) ??
    mapping?.profiles[0];
  return { offeredProviders, mapping, profile };
}

/**
 * Effective parameter values of a profile: the user's choice when the
 * profile offers it, otherwise the profile default.
 */
export function resolveParameters(
  profile: Profile,
  chosen: Record<string, ParameterValue>,
): Record<string, ParameterValue> {
  const values: Record<string, ParameterValue> = {};
  for (const parameter of profile.parameters ?? []) {
    const choice = chosen[parameter.id];
    values[parameter.id] =
      choice !== undefined && parameter.options.includes(choice)
        ? choice
        : parameter.defaultValue;
  }
  return values;
}

/**
 * The usage scenario to calculate: one usage per card that a selected
 * provider offers, with the provider, profile and parameters it really uses.
 */
export function buildCalculateRequest(
  useCases: UseCase[],
  cardStates: Record<string, CardState>,
  availableProviderIds: Iterable<string>,
  headcount: number,
): CalculateRequest {
  const available = Array.from(availableProviderIds);
  const usages: UsageRequest[] = [];
  for (const useCase of useCases) {
    const state = cardStates[useCase.id];
    if (!state) continue;
    const { mapping, profile } = resolveSelection(useCase, available, state);
    if (!mapping || !profile) continue;
    const usage: UsageRequest = {
      kind: useCase.kind,
      useCaseId: useCase.id,
      providerId: mapping.providerId,
      profileId: profile.id,
      frequencyPerDay: Math.max(0, state.frequencyPerDay || 0),
    };
    if (useCase.kind === "video") {
      usage.parameters = resolveParameters(profile, state.parameters);
    }
    usages.push(usage);
  }
  return {
    usages,
    // The backend requires at least 1 (an empty or invalid field counts as 1).
    headcount: Math.max(1, Math.floor(headcount) || 1),
  };
}

/** Whether a calculated usage matches what the card currently asks for. */
export function isUsageResultCurrent(
  request: UsageRequest,
  result: UsageResult,
): boolean {
  const parameters = request.parameters ?? {};
  return (
    result.useCaseId === request.useCaseId &&
    result.providerId === request.providerId &&
    result.profileId === request.profileId &&
    result.frequencyPerDay === request.frequencyPerDay &&
    Object.entries(parameters).every(([id, value]) => result.parameters[id] === value)
  );
}
