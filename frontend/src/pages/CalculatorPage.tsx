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
import { formatNumber, scaleRange } from "../domain/units";

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

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="calculator-section__header">
      <span className="calculator-section__badge">{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ImpactsGrid({ impacts, title }: { impacts: Impacts; title: string }) {
  const { t } = useTranslation();
  return (
    <section className="impacts-grid">
      <h3>{title}</h3>
      {CRITERIA.map(({ key, unit }) => {
        const value = impacts[key];
        return value === null ? (
          <p key={key} className="impacts-grid__unavailable">
            {t(`calculator.criterion.${key}`)}: {t("calculator.notAvailable")}
          </p>
        ) : (
          <RangeGauge
            key={key}
            min={value.min}
            max={value.max}
            unit={unit}
            label={t(`calculator.criterion.${key}`)}
          />
        );
      })}
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
        {entries.map(([providerId, impacts]) => {
          const scaled = scaleRange(
            impacts.gwp!.min,
            impacts.gwp!.max,
            "kgCO2eq",
          );
          return (
            <li key={providerId}>
              <strong>
                {t(`providers.${providerId}`, { defaultValue: providerId })}
              </strong>{" "}
              {formatNumber(scaled.min)} – {formatNumber(scaled.max)}{" "}
              {scaled.unit}
            </li>
          );
        })}
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

      <section className="calculator-section">
        <SectionHeader
          step={1}
          title={t("calculator.sectionEcosystem.title")}
          description={t("calculator.sectionEcosystem.description")}
        />
        <ProviderChips
          providers={catalog.providers}
          selected={selectedProviders}
          onToggle={toggleProvider}
        />
      </section>

      <section className="calculator-section calculator-section--split">
        <div className="calculator-section__col calculator-section__col--main">
          <SectionHeader
            step={2}
            title={t("calculator.sectionUsage.title")}
            description={t("calculator.sectionUsage.description")}
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
        </div>

        <div className="calculator-section__col calculator-section__col--aside">
          <ImpactsGrid
            impacts={individualAnnual}
            title={t("calculator.resultIndividualAnnual")}
          />
          <Co2Equivalents gwpKgCo2eq={individualAnnual.gwp!.max} />
          <ProviderBreakdown breakdown={providerBreakdown} />
        </div>
      </section>

      <section className="calculator-section calculator-section--split">
        <div className="calculator-section__col calculator-section__col--aside">
          <SectionHeader
            step={3}
            title={t("calculator.sectionEnterprise.title")}
            description={t("calculator.sectionEnterprise.description")}
          />
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
        </div>

        <div className="calculator-section__col calculator-section__col--main">
          <ImpactsGrid
            impacts={enterpriseAnnual}
            title={t("calculator.resultEnterpriseAnnual")}
          />
        </div>
      </section>
    </div>
  );
}
