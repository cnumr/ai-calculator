import { useTranslation } from "react-i18next";
import type { ImpactRange } from "../api/client";
import { formatNumber, scaleRange } from "../domain/units";

interface GwpSummaryProps {
  impact: ImpactRange | null;
  scope: "individual" | "enterprise";
}

export function GwpSummary({ impact, scope }: GwpSummaryProps) {
  const { t } = useTranslation();
  if (!impact) return null;

  const range = scaleRange(impact.min, impact.max, "kgCO2eq");
  const midpoint = (range.min + range.max) / 2;

  return (
    <section className="gwp-summary" aria-labelledby={`gwp-summary-${scope}`}>
      <h3 id={`gwp-summary-${scope}`}>{t(`calculator.gwpSummary.${scope}`)}</h3>
      <p className="gwp-summary__value">
        {formatNumber(midpoint)} <span>{range.unit}</span>
      </p>
      <p className="gwp-summary__range">
        {t("calculator.gwpSummary.range", {
          min: formatNumber(range.min),
          max: formatNumber(range.max),
          unit: range.unit,
        })}
      </p>
      {scope === "individual" && (
        <p className="gwp-summary__note">{t("calculator.gwpSummary.workingDays")}</p>
      )}
    </section>
  );
}
