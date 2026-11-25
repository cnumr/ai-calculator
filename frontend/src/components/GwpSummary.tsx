import { useTranslation } from "react-i18next";
import type { ImpactRange } from "../api/client";
import { formatNumber, scaleImpact } from "../domain/units";

interface GwpSummaryProps {
  impact: ImpactRange | null;
  scope: "individual" | "enterprise";
}

export function GwpSummary({ impact, scope }: GwpSummaryProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  if (!impact) return null;

  const range = scaleImpact(impact, "kgCO2eq");

  return (
    <section
      className="gwp-summary"
      aria-labelledby={`gwp-summary-${scope}`}
      data-tour={`${scope}-total`}
    >
      <h3 id={`gwp-summary-${scope}`}>{t(`calculator.gwpSummary.${scope}`)}</h3>
      <p className="gwp-summary__value">
        {formatNumber(range.value, locale)} <span>{range.unit}</span>
      </p>
      <p className="gwp-summary__range">
        {t("calculator.gwpSummary.range", {
          min: formatNumber(range.min, locale),
          max: formatNumber(range.max, locale),
          unit: range.unit,
        })}
      </p>
      {scope === "individual" && (
        <p className="gwp-summary__note">{t("calculator.gwpSummary.workingDays")}</p>
      )}
    </section>
  );
}
