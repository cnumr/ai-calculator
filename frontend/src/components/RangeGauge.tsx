import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ImpactRange } from "../api/client";
import { formatNumber, scaleImpact } from "../domain/units";

export function gaugePositions(
  min: number,
  max: number,
  value: number,
): { fillLeftPct: number; fillRightPct: number; tickLeftPct: number } {
  if (max <= 0) {
    return { fillLeftPct: 0, fillRightPct: 100, tickLeftPct: 0 };
  }
  const scale = max * 1.1;
  return {
    fillLeftPct: (min / scale) * 100,
    fillRightPct: 100 - (max / scale) * 100,
    tickLeftPct: (value / scale) * 100,
  };
}

interface RangeGaugeProps {
  range: ImpactRange;
  unit: string;
  label: ReactNode;
}

export function RangeGauge({ range, unit, label }: RangeGaugeProps) {
  const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(
    range.min,
    range.max,
    range.value,
  );
  const scaled = scaleImpact(range, unit);
  const locale = useTranslation().i18n.language;

  return (
    <div className="range-gauge">
      <div className="range-gauge__label">{label}</div>
      {/* Sits over the tick; shifted by its own position so it never overflows. */}
      <div className="range-gauge__value-row">
        <strong
          className="range-gauge__value"
          style={{ left: `${tickLeftPct}%`, transform: `translateX(-${tickLeftPct}%)` }}
        >
          {formatNumber(scaled.value, locale)} {scaled.unit}
        </strong>
      </div>
      <div className="range-gauge__track">
        <div
          className="range-gauge__fill"
          style={{ left: `${fillLeftPct}%`, right: `${fillRightPct}%` }}
        />
        <div
          className="range-gauge__tick"
          style={{ left: `${tickLeftPct}%` }}
        />
      </div>
      <div className="range-gauge__bounds">
        <span>
          min {formatNumber(scaled.min, locale)} {scaled.unit}
        </span>
        <span>
          max {formatNumber(scaled.max, locale)} {scaled.unit}
        </span>
      </div>
    </div>
  );
}
