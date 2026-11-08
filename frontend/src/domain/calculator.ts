import type {
  Impacts,
  ParameterValue,
  Profile,
  ProviderMapping,
  UseCase,
} from "../api/client";
import { scaleImpacts } from "./aggregate";

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
 * Impacts of a profile for the user's parameter choices: the matching
 * precomputed variant, or the profile's default impacts.
 */
export function resolveImpacts(
  profile: Profile,
  chosen: Record<string, ParameterValue>,
): Impacts {
  const values = resolveParameters(profile, chosen);
  const variant = (profile.variants ?? []).find((v) =>
    Object.entries(values).every(([id, value]) => v.values[id] === value),
  );
  return variant?.impacts ?? profile.impacts;
}

/**
 * Annual impacts of each card, attributed to the provider the card really
 * uses. Cards offered by no selected provider contribute nothing.
 */
export function computeAnnualEntries(
  useCases: UseCase[],
  cardStates: Record<string, CardState>,
  availableProviderIds: Iterable<string>,
  workingDaysPerYear: number,
): Array<{ providerId: string; impacts: Impacts }> {
  const available = Array.from(availableProviderIds);
  const entries: Array<{ providerId: string; impacts: Impacts }> = [];
  for (const useCase of useCases) {
    const state = cardStates[useCase.id];
    if (!state) continue;
    const { mapping, profile } = resolveSelection(useCase, available, state);
    if (!mapping || !profile) continue;
    entries.push({
      providerId: mapping.providerId,
      impacts: scaleImpacts(
        resolveImpacts(profile, state.parameters),
        state.frequencyPerDay * workingDaysPerYear,
      ),
    });
  }
  return entries;
}
