import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Impacts, UseCasesCatalog, fetchUseCases } from "../api/client";
import { ProviderChips } from "../components/ProviderChips";
import { UseCaseCard } from "../components/UseCaseCard";
import { RangeGauge } from "../components/RangeGauge";
import { Co2Equivalents } from "../components/Co2Equivalents";
import {
  aggregateByProvider,
  scaleImpacts,
  sumImpacts,
  zeroImpacts,
} from "../domain/aggregate";

const WORKING_DAYS_PER_YEAR = 220;

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

interface CardState {
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
}

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

function ProviderBreakdown({
  breakdown,
}: {
  breakdown: Record<string, Impacts>;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;

  return (
    <section className="provider-breakdown">
      <h3>{t("calculator.breakdownByProvider")}</h3>
      <ul>
        {entries.map(([providerId, impacts]) => (
          <li key={providerId}>
            <strong>
              {t(`providers.${providerId}`, { defaultValue: providerId })}
            </strong>{" "}
            {impacts.gwp.min.toPrecision(3)} – {impacts.gwp.max.toPrecision(3)}{" "}
            kgCO2eq
          </li>
        ))}
      </ul>
      <details>
        <summary>{t("calculator.detailsToggle")}</summary>
        {entries.map(([providerId, impacts]) => (
          <ImpactsGrid
            key={providerId}
            impacts={impacts}
            title={t(`providers.${providerId}`, { defaultValue: providerId })}
          />
        ))}
      </details>
    </section>
  );
}

export function CalculatorPage() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<UseCasesCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [cardImpacts, setCardImpacts] = useState<
    Record<string, { providerId: string; impacts: Impacts }>
  >({});
  const [headcount, setHeadcount] = useState(1);

  const loadCatalog = useCallback(() => {
    setLoadError(false);
    setCatalog(null);
    fetchUseCases()
      .then((loaded) => {
        setCatalog(loaded);
        setSelectedProviders(
          new Set(
            loaded.providers
              .filter((p) => p.selectedByDefault)
              .map((p) => p.id),
          ),
        );
        const initialStates: Record<string, CardState> = {};
        for (const useCase of loaded.useCases) {
          const firstMapping = useCase.providers[0];
          initialStates[useCase.id] = {
            providerId: firstMapping?.providerId ?? "",
            profileId: firstMapping?.profiles[0]?.id ?? "",
            frequencyPerDay: 1,
          };
        }
        setCardStates(initialStates);
      })
      .catch(() => {
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  function toggleProvider(id: string) {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loadError) {
    return (
      <div className="calculator-error-page">
        <p role="alert">{t("calculator.errorCatalogLoad")}</p>
        <button type="button" onClick={loadCatalog}>
          {t("calculator.retry")}
        </button>
      </div>
    );
  }

  if (!catalog) {
    return null;
  }

  const individualAnnual = Object.entries(cardImpacts).reduce(
    (total, [useCaseId, entry]) =>
      sumImpacts(
        total,
        scaleImpacts(
          entry.impacts,
          (cardStates[useCaseId]?.frequencyPerDay ?? 0) * WORKING_DAYS_PER_YEAR,
        ),
      ),
    zeroImpacts(),
  );

  const perCardAnnualEntries = Object.entries(cardImpacts).map(
    ([useCaseId, entry]) => ({
      providerId: entry.providerId,
      impacts: scaleImpacts(
        entry.impacts,
        (cardStates[useCaseId]?.frequencyPerDay ?? 0) * WORKING_DAYS_PER_YEAR,
      ),
    }),
  );
  const providerBreakdown = aggregateByProvider(perCardAnnualEntries);
  const enterpriseAnnual = scaleImpacts(individualAnnual, headcount);

  return (
    <div className="calculator-page">
      <div className="calculator-hero">
        <h1>{t("calculator.title")}</h1>
      </div>

      <ProviderChips
        providers={catalog.providers}
        selected={selectedProviders}
        onToggle={toggleProvider}
      />

      <div className="use-case-catalog">
        {catalog.useCases.map((useCase) => {
          const state = cardStates[useCase.id];
          if (!state) return null;
          return (
            <UseCaseCard
              key={useCase.id}
              useCase={useCase}
              availableProviderIds={Array.from(selectedProviders)}
              providerId={state.providerId}
              profileId={state.profileId}
              frequencyPerDay={state.frequencyPerDay}
              onChange={(next) =>
                setCardStates((prev) => ({ ...prev, [useCase.id]: next }))
              }
              onImpactsChange={(impacts) =>
                setCardImpacts((prev) => ({
                  ...prev,
                  [useCase.id]: { providerId: state.providerId, impacts },
                }))
              }
            />
          );
        })}
      </div>

      <ImpactsGrid
        impacts={individualAnnual}
        title={t("calculator.resultIndividualAnnual")}
      />
      <Co2Equivalents gwpKgCo2eq={individualAnnual.gwp.max} />
      <ProviderBreakdown breakdown={providerBreakdown} />

      <div className="calculator-form__field">
        <label htmlFor="calculator-headcount">
          {t("calculator.headcount")}
        </label>
        <input
          id="calculator-headcount"
          type="number"
          min={1}
          value={headcount}
          onChange={(e) => setHeadcount(Number(e.target.value))}
        />
      </div>
      <ImpactsGrid
        impacts={enterpriseAnnual}
        title={t("calculator.resultEnterpriseAnnual")}
      />
    </div>
  );
}
