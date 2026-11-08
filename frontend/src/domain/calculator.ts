import type {
  Impacts,
  Profile,
  ProviderMapping,
  UseCase,
} from "../api/client";
import { scaleImpacts } from "./aggregate";

export interface CardState {
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
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
        profile.impacts,
        state.frequencyPerDay * workingDaysPerYear,
      ),
    });
  }
  return entries;
}
