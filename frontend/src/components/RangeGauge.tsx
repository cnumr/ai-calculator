import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, scaleRange } from "../domain/units";

export function gaugePositions(
  min: number,
  max: number,
): { fillLeftPct: number; fillRightPct: number; tickLeftPct: number } {
  if (max <= 0) {
    return { fillLeftPct: 0, fillRightPct: 100, tickLeftPct: 0 };
  }
  const scale = max * 1.1;
  return {
    fillLeftPct: (min / scale) * 100,
    fillRightPct: 100 - (max / scale) * 100,
    tickLeftPct: ((min + max) / 2 / scale) * 100,
  };
}

interface RangeGaugeProps {
  min: number;
  max: number;
  unit: string;
  label: ReactNode;
}

export function RangeGauge({ min, max, unit, label }: RangeGaugeProps) {
  const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(min, max);
  const scaled = scaleRange(min, max, unit);
  const locale = useTranslation().i18n.language;
  // Central value, as in the summary card: the tick sits on it.
  const value = (scaled.min + scaled.max) / 2;

  return (
    <div className="range-gauge">
      <div className="range-gauge__label">{label}</div>
      {/* Sits over the tick; shifted by its own position so it never overflows. */}
      <div className="range-gauge__value-row">
        <strong
          className="range-gauge__value"
          style={{ left: `${tickLeftPct}%`, transform: `translateX(-${tickLeftPct}%)` }}
        >
          {formatNumber(value, locale)} {scaled.unit}
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
