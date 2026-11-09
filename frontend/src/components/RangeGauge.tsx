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

  return (
    <div className="range-gauge">
      <div className="range-gauge__label">{label}</div>
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
