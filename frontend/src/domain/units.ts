interface UnitStep {
  unit: string;
  factor: number;
}

// Keys are base-unit identifiers used across the app (e.g. "kgCO2eq");
// `unit` is the label displayed to users.
const LADDERS: Record<string, UnitStep[]> = {
  kgCO2eq: [
    { unit: "mg CO2eq", factor: 1e6 },
    { unit: "g CO2eq", factor: 1e3 },
    { unit: "kg CO2eq", factor: 1 },
    { unit: "t CO2eq", factor: 1e-3 },
  ],
  kgSbeq: [
    { unit: "mg Sbeq", factor: 1e6 },
    { unit: "g Sbeq", factor: 1e3 },
    { unit: "kg Sbeq", factor: 1 },
    { unit: "t Sbeq", factor: 1e-3 },
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

/**
 * Formats a value with three significant digits (no scientific notation),
 * using the decimal and grouping separators of `locale` (e.g. "1,20" in
 * French, "1.20" in English).
 */
export function formatNumber(value: number, locale: string): string {
  if (value === 0) {
    return "0";
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.min(20, Math.max(0, 2 - exponent));
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formats a value rounded to an integer, grouped according to `locale`. */
export function formatInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value,
  );
}
