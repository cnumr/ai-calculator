import type { Impacts, ImpactRange } from "../api/client";

const CRITERIA = ["gwp", "energy", "adpe", "pe", "water"] as const;

export function zeroImpacts(): Impacts {
  const zero: ImpactRange = { min: 0, max: 0 };
  return { gwp: zero, energy: zero, adpe: zero, pe: zero, water: zero };
}

export function scaleImpacts(impacts: Impacts, factor: number): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    const value = impacts[key];
    result[key] =
      value === null
        ? null
        : { min: value.min * factor, max: value.max * factor };
  }
  return result;
}

export function sumImpacts(a: Impacts, b: Impacts): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    const va = a[key];
    const vb = b[key];
    result[key] =
      va === null && vb === null
        ? null
        : {
            min: (va?.min ?? 0) + (vb?.min ?? 0),
            max: (va?.max ?? 0) + (vb?.max ?? 0),
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
