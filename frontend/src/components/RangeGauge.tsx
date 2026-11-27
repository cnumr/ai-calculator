import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ImpactRange } from "../api/client";
import { formatNumber, niceCeiling, scaleImpact } from "../domain/units";

/**
 * Positions on the gauge, in % of its width. The scale is absolute: from 0
 * to the round number just above max, shown under the gauge.
 */
export function gaugePositions(
  min: number,
  max: number,
  value: number,
): { fillLeftPct: number; fillRightPct: number; tickLeftPct: number; scaleMax: number } {
  if (max <= 0) {
    return { fillLeftPct: 0, fillRightPct: 100, tickLeftPct: 0, scaleMax: 0 };
  }
  const scaleMax = niceCeiling(max);
  return {
    fillLeftPct: (min / scaleMax) * 100,
    fillRightPct: 100 - (max / scaleMax) * 100,
    tickLeftPct: (value / scaleMax) * 100,
    scaleMax,
  };
}

interface RangeGaugeProps {
  range: ImpactRange;
  unit: string;
  label: ReactNode;
}

export function RangeGauge({ range, unit, label }: RangeGaugeProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { fillLeftPct, fillRightPct, tickLeftPct, scaleMax } = gaugePositions(
    range.min,
    range.max,
    range.value,
  );
  const scaled = scaleImpact(range, unit);
  // The end of the scale, in the unit of the values.
  const scaledEnd = scaleImpact({ ...range, value: scaleMax }, unit).value;
  const format = (n: number) => formatNumber(n, locale);

  return (
    <div className="range-gauge">
      <div className="range-gauge__label">{label}</div>
      <span className="visually-hidden">
        {t("calculator.gauge.estimate", {
          value: `${format(scaled.value)} ${scaled.unit}`,
          min: format(scaled.min),
          max: `${format(scaled.max)} ${scaled.unit}`,
        })}
      </span>
      {/* "low < value < high", over the tick; shifted by
          its own position so that it never overflows. */}
      <div className="range-gauge__value-row" aria-hidden="true">
        <span
          className="range-gauge__estimate"
          style={{ left: `${tickLeftPct}%`, transform: `translateX(-${tickLeftPct}%)` }}
        >
          <span className="range-gauge__bound" title={t("calculator.gauge.low")}>
            {format(scaled.min)}
          </span>{" "}
          <span className="range-gauge__sep">&lt;</span>{" "}
          <strong className="range-gauge__value">
            {format(scaled.value)} {scaled.unit}
          </strong>{" "}
          <span className="range-gauge__sep">&lt;</span>{" "}
          <span className="range-gauge__bound" title={t("calculator.gauge.high")}>
            {format(scaled.max)}
          </span>
        </span>
      </div>
      <div className="range-gauge__track" aria-hidden="true">
        <div
          className="range-gauge__fill"
          style={{ left: `${fillLeftPct}%`, right: `${fillRightPct}%` }}
        />
        <div className="range-gauge__tick" style={{ left: `${tickLeftPct}%` }} />
      </div>
      <div className="range-gauge__scale" aria-hidden="true">
        <span>0</span>
        <span>
          {format(scaledEnd)} {scaled.unit}
        </span>
      </div>
    </div>
  );
}
