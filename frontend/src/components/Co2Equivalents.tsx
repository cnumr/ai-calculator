import { useTranslation } from "react-i18next";
import type { Co2EquivalentQuantity } from "../api/client";
import { formatInteger } from "../domain/units";

interface Co2EquivalentsProps {
  /** Quantities computed by the backend (ImpactCO2 factors). */
  equivalents: Co2EquivalentQuantity[];
  /** GHG they correspond to, used to open the ImpactCO2 comparator. */
  gwpKgCo2eq: number;
}

export function Co2Equivalents({ equivalents, gwpKgCo2eq }: Co2EquivalentsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const slugs = equivalents.map((eq) => eq.impactCo2Slug).join(",");

  return (
    <section className="co2-equivalents" aria-labelledby="co2-equivalents-heading">
      <h3 id="co2-equivalents-heading">{t("calculator.co2EquivalentsHeading")}</h3>
      <ul>
        {equivalents.map((eq) => {
          const count = Math.round(eq.quantity);
          return (
            <li key={eq.id}>
              <span className="co2-equivalents__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {eq.id === "car_km" && <><path d="M3 16V9l2-4h14l2 4v7" /><path d="M3 13h18" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>}
                  {eq.id === "streaming_hour" && <><rect x="4" y="4" width="16" height="12" rx="1" /><path d="m10 8 5 2-5 2Z M8 20h8" /></>}
                  {eq.id === "smartphone" && <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 6h4M11 18h2" /></>}
                </svg>
              </span>
             {t(`calculator.co2Equivalent.${eq.id}`, {
               count,
               value: formatInteger(count, locale),
             })}
            </li>
          );
        })}
      </ul>
      <a className="co2-equivalents__link" href={`https://impactco2.fr/outils/comparateur?value=${gwpKgCo2eq.toFixed(2)}&comparisons=${slugs}&language=${locale}`} target="_blank" rel="noreferrer">
        {t("calculator.compareOnImpactCo2")}
      </a>
    </section>
  );
}
