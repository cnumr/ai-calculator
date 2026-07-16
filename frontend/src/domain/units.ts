interface UnitStep {
  unit: string;
  factor: number;
}

const LADDERS: Record<string, UnitStep[]> = {
  kgCO2eq: [
    { unit: "mgCO2eq", factor: 1e6 },
    { unit: "gCO2eq", factor: 1e3 },
    { unit: "kgCO2eq", factor: 1 },
    { unit: "tCO2eq", factor: 1e-3 },
  ],
  kgSbeq: [
    { unit: "mgSbeq", factor: 1e6 },
    { unit: "gSbeq", factor: 1e3 },
    { unit: "kgSbeq", factor: 1 },
    { unit: "tSbeq", factor: 1e-3 },
  ],
  kWh: [
    { unit: "Wh", factor: 1e3 },
    { unit: "kWh", factor: 1 },
    { unit: "MWh", factor: 1e-3 },
    { unit: "GWh", factor: 1e-6 },
  ],
  MJ: [
    { unit: "J", factor: 1e6 },
    { unit: "kJ", factor: 1e3 },
    { unit: "MJ", factor: 1 },
    { unit: "GJ", factor: 1e-3 },
    { unit: "TJ", factor: 1e-6 },
  ],
  L: [
    { unit: "mL", factor: 1e3 },
    { unit: "L", factor: 1 },
    { unit: "m³", factor: 1e-3 },
    { unit: "ML", factor: 1e-6 },
  ],
};

function pickStep(referenceValue: number, ladder: UnitStep[]): UnitStep {
  const baseStep = ladder.find((step) => step.factor === 1) ?? ladder[0];
  if (referenceValue === 0) {
    return baseStep;
  }
  const abs = Math.abs(referenceValue);
  const byGrowingUnit = [...ladder].sort((a, b) => a.factor - b.factor);
  for (const step of byGrowingUnit) {
    if (abs * step.factor >= 1) {
      return step;
    }
  }
  return byGrowingUnit[byGrowingUnit.length - 1];
}

export function scaleRange(
  min: number,
  max: number,
  baseUnit: string,
): { min: number; max: number; unit: string } {
  const ladder = LADDERS[baseUnit];
  if (!ladder) {
    return { min, max, unit: baseUnit };
  }
  const reference = Math.max(Math.abs(min), Math.abs(max));
  const step = pickStep(reference, ladder);
  return { min: min * step.factor, max: max * step.factor, unit: step.unit };
}

export function formatNumber(value: number): string {
  if (value === 0) {
    return "0";
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.min(20, Math.max(0, 2 - exponent));
  return value.toFixed(decimals);
}
