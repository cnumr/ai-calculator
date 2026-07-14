import type { Impacts, ImpactRange } from "../api/client";

const CRITERIA = ["gwp", "energy", "adpe", "pe", "water"] as const;

export function zeroImpacts(): Impacts {
  const zero: ImpactRange = { min: 0, max: 0 };
  return { gwp: zero, energy: zero, adpe: zero, pe: zero, water: zero };
}

export function scaleImpacts(impacts: Impacts, factor: number): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    result[key] = {
      min: impacts[key].min * factor,
      max: impacts[key].max * factor,
    };
  }
  return result;
}

export function sumImpacts(a: Impacts, b: Impacts): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    result[key] = {
      min: a[key].min + b[key].min,
      max: a[key].max + b[key].max,
    };
  }
  return result;
}

export function aggregateByProvider(
  entries: Array<{ providerId: string; impacts: Impacts }>,
): Record<string, Impacts> {
  const result: Record<string, Impacts> = {};
  for (const entry of entries) {
    result[entry.providerId] = sumImpacts(
      result[entry.providerId] ?? zeroImpacts(),
      entry.impacts,
    );
  }
  return result;
}
