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
  label: string;
}

export function RangeGauge({ min, max, unit, label }: RangeGaugeProps) {
  const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(min, max);

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
          min {min.toPrecision(3)} {unit}
        </span>
        <span>
          max {max.toPrecision(3)} {unit}
        </span>
      </div>
    </div>
  );
}
