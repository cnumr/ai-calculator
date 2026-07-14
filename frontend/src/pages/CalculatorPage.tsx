import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  CalculateResult,
  Impacts,
  ProviderModel,
  calculate,
  fetchProviders,
} from "../api/client";
import { RangeGauge } from "../components/RangeGauge";
import { Co2Equivalents } from "../components/Co2Equivalents";

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

function ImpactsGrid({ impacts, title }: { impacts: Impacts; title: string }) {
  const { t } = useTranslation();
  return (
    <section className="impacts-grid">
      <h3>{title}</h3>
      {CRITERIA.map(({ key, unit }) => (
        <RangeGauge
          key={key}
          min={impacts[key].min}
          max={impacts[key].max}
          unit={unit}
          label={t(`calculator.criterion.${key}`)}
        />
      ))}
    </section>
  );
}

export function CalculatorPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderModel[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [outputTokens, setOutputTokens] = useState(200);
  const [requestsPerDay, setRequestsPerDay] = useState(10);
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders().then(setProviders);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const selected = providers[selectedIndex];
    if (!selected) return;
    try {
      const calculated = await calculate({
        provider: selected.provider,
        model: selected.name,
        outputTokens,
        requestsPerDay,
      });
      setResult(calculated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(t("calculator.errorModelNotFound"));
      } else {
        setError(t("calculator.errorGeneric"));
      }
    }
  }

  return (
    <div>
      <div className="calculator-hero">
        <h1>{t("calculator.title")}</h1>
      </div>
      <form className="calculator-form" onSubmit={handleSubmit}>
        <div className="calculator-form__field">
          <label htmlFor="calculator-model">{t("calculator.model")}</label>
          <select
            id="calculator-model"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {providers.map((p, index) => (
              <option key={`${p.provider}-${p.name}`} value={index}>
                {p.provider} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="calculator-form__field">
          <label htmlFor="calculator-output-tokens">
            {t("calculator.outputTokens")}
          </label>
          <input
            id="calculator-output-tokens"
            type="number"
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
          />
        </div>
        <div className="calculator-form__field">
          <label htmlFor="calculator-requests-per-day">
            {t("calculator.requestsPerDay")}
          </label>
          <input
            id="calculator-requests-per-day"
            type="number"
            value={requestsPerDay}
            onChange={(e) => setRequestsPerDay(Number(e.target.value))}
          />
        </div>
        <button className="calculator-form__submit" type="submit">
          {t("calculator.submit")}
        </button>
      </form>

      {error && (
        <p className="calculator-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <ImpactsGrid
            impacts={result.unit}
            title={t("calculator.resultUnit")}
          />
          <ImpactsGrid
            impacts={result.individualAnnual}
            title={t("calculator.resultIndividualAnnual")}
          />
          <Co2Equivalents gwpKgCo2eq={result.individualAnnual.gwp.max} />
          <ImpactsGrid
            impacts={result.enterpriseAnnual}
            title={t("calculator.resultEnterpriseAnnual")}
          />
        </>
      )}
    </div>
  );
}
