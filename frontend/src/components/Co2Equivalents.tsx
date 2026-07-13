import { useTranslation } from "react-i18next";
// kgCo2eqPerUnit values in co2-equivalents.json are illustrative placeholders;
// replace with exact figures from ImpactCO2's equivalents.csv before merging.
import equivalents from "../data/co2-equivalents.json";

interface Co2EquivalentsProps {
  gwpKgCo2eq: number;
}

export function Co2Equivalents({ gwpKgCo2eq }: Co2EquivalentsProps) {
  const { t } = useTranslation();

  return (
    <ul>
      {equivalents.map((eq) => {
        const count = Math.round(gwpKgCo2eq / eq.kgCo2eqPerUnit);
        return (
          <li key={eq.id}>
            {t(`calculator.co2Equivalent.${eq.id}`, { count })}
          </li>
        );
      })}
    </ul>
  );
}
