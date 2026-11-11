import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Impacts,
  ProviderShare,
  UseCasesCatalog,
} from "../api/client";
import { loadCatalog as loadSharedCatalog } from "../api/catalogStore";
import { ProviderChips } from "../components/ProviderChips";
import { UseCaseCard } from "../components/UseCaseCard";
import { RangeGauge } from "../components/RangeGauge";
import { ImpactIcon, isImpactCriterion } from "../components/ImpactIcon";
import { Co2Equivalents } from "../components/Co2Equivalents";
import { GwpSummary } from "../components/GwpSummary";
import { ProviderLogo } from "../components/ProviderLogo";
import { LazyDetails } from "../components/LazyDetails";
import {
  CardState,
  buildCalculateRequest,
  isUsageResultCurrent,
} from "../domain/calculator";
import { formatNumber, scaleRange } from "../domain/units";
import { useCalculation } from "../hooks/useCalculation";

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

/**
 * Use cases grouped by family, in the catalogue's family order; use cases
 * without a known family come last, without a heading. With `shown`, only
 * those use cases (and their families) are listed.
 */
function groupByFamily(catalog: UseCasesCatalog, shown: Set<string> | null = null) {
  const families = catalog.families ?? [];
  const useCases = shown
    ? catalog.useCases.filter((uc) => shown.has(uc.id))
    : catalog.useCases;
  const groups = families.map((family) => ({
    family: family as string | null,
    useCases: useCases.filter((uc) => uc.family === family),
  }));
  const others = useCases.filter(
    (uc) => !uc.family || !families.includes(uc.family),
  );
  if (others.length > 0) groups.push({ family: null, useCases: others });
  return groups.filter((group) => group.useCases.length > 0);
}

function createInitialCardStates(useCases: UseCasesCatalog["useCases"]) {
  const states: Record<string, CardState> = {};
  for (const useCase of useCases) {
    const mapping =
      useCase.providers.find(
        (item) => item.providerId === useCase.defaultProviderId,
      ) ?? useCase.providers[0];
    const profile =
      mapping?.profiles.find(
        (item) => item.id === useCase.recommendedProfileId,
      ) ?? mapping?.profiles[0];
    states[useCase.id] = {
      providerId: mapping?.providerId ?? "",
      profileId: profile?.id ?? "",
      // No usage by default: the user enters their own frequencies.
      frequency: 0,
      frequencyUnit: "day",
      parameters: {},
    };
  }
  return states;
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
        const label = t(`calculator.criterion.${key}`);
        const hasIcon = isImpactCriterion(key);
        return value === null ? (
          <p key={key} className="impacts-grid__unavailable">
            {label}: {t("calculator.notAvailable")}
          </p>
        ) : (
          <RangeGauge
            key={key}
            min={value.min}
            max={value.max}
            unit={unit}
            label={
              hasIcon ? (
                <>
                  <ImpactIcon
                    criterion={key}
                    className="impact-icon--detail"
                    decorative
                  />
                  <span>{label}</span>
                </>
              ) : (
                label
              )
            }
          />
        );
      })}
    </section>
  );
}

function ProviderBreakdown({ shares }: { shares: ProviderShare[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  if (shares.length === 0) return null;

  return (
    <section className="provider-breakdown">
      <h3>{t("calculator.breakdownByProvider")}</h3>
      <ul>
        {shares.map(({ providerId, annualImpacts: impacts, gwpSharePercent: percentage }) => {
          const scaled = scaleRange(
            impacts.gwp?.min ?? 0,
            impacts.gwp?.max ?? 0,
            "kgCO2eq",
          );
          return (
            <li key={providerId}>
              <strong className="provider-breakdown__name">
                <ProviderLogo
                  providerId={providerId}
                  label={t(`providers.${providerId}`, { defaultValue: providerId })}
                  className="provider-breakdown__logo"
                  fallbackClassName="provider-breakdown__logo provider-breakdown__logo--fallback"
                />
                {t(`providers.${providerId}`, { defaultValue: providerId })}
              </strong>{" "}
              {formatNumber(scaled.min, locale)} – {formatNumber(scaled.max, locale)}{" "}
              {scaled.unit}
              <span className="provider-breakdown__share">
                {formatNumber(percentage, locale)} %
              </span>
              <meter min="0" max="100" value={percentage} aria-label={`${t(`providers.${providerId}`, { defaultValue: providerId })}: ${formatNumber(percentage, locale)} %`} />
            </li>
          );
        })}
      </ul>
      <LazyDetails summary={t("calculator.detailsToggle")}>
        {() =>
          shares.map(({ providerId, annualImpacts }) => (
            <ImpactsGrid
              key={providerId}
              impacts={annualImpacts}
              title={t(`providers.${providerId}`, { defaultValue: providerId })}
            />
          ))
        }
      </LazyDetails>
    </section>
  );
}

export function CalculatorPage() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<UseCasesCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set()
  );
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [headcount, setHeadcount] = useState(1);
  // "Only my usages": the use cases used when the filter was turned on (null
  // when off). Kept fixed while on, so that a row does not vanish while its
  // frequency is being edited (e.g. cleared before typing a new value).
  const [shownUseCases, setShownUseCases] = useState<Set<string> | null>(null);

  const request = useMemo(
    () =>
      catalog
        ? buildCalculateRequest(
            catalog.useCases,
            cardStates,
            selectedProviders,
            headcount,
          )
        : null,
    [catalog, cardStates, selectedProviders, headcount],
  );
  const { result, status, retry } = useCalculation(request);
  // Use cases with a frequency: the ones "Only my usages" keeps.
  const usedUseCaseIds = (catalog?.useCases ?? [])
    .filter((uc) => (cardStates[uc.id]?.frequency ?? 0) > 0)
    .map((uc) => uc.id);

  const loadCatalog = useCallback(() => {
    setLoadError(false);
    setCatalog(null);
    loadSharedCatalog()
      .then((loaded) => {
        setCatalog(loaded);
        setSelectedProviders(
          new Set(
            loaded.providers.filter((p) => p.selectedByDefault).map((p) => p.id)
          )
        );
        setCardStates(createInitialCardStates(loaded.useCases));
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

  function resetCalculator() {
    setShownUseCases(null);
    if (!catalog) return;
    setSelectedProviders(new Set(catalog.providers.filter((p) => p.selectedByDefault).map((p) => p.id)));
    setCardStates(createInitialCardStates(catalog.useCases));
    setHeadcount(1);
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

  const calculating = status === "loading";

  return (
    <div className="calculator-page">
      <div className="calculator-hero">
        <h1>{t("calculator.title")}</h1>
        <button type="button" className="calculator-reset" onClick={resetCalculator}>
          {t("calculator.reset")}
        </button>
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
            <div className="use-case-catalog__columns">
              <label className="use-case-catalog__filter">
                <input
                  type="checkbox"
                  checked={shownUseCases !== null}
                  disabled={shownUseCases === null && usedUseCaseIds.length === 0}
                  onChange={(e) =>
                    setShownUseCases(e.target.checked ? new Set(usedUseCaseIds) : null)
                  }
                />
                {t("calculator.onlyUsed", { count: usedUseCaseIds.length })}
              </label>
              {/* Column titles of the rows below (each field keeps its own label). */}
              <span aria-hidden="true">{t("calculator.columnFrequency")}</span>
              <span aria-hidden="true">{t("calculator.columnImpact")}</span>
              <span aria-hidden="true" />
            </div>
            {groupByFamily(catalog, shownUseCases).map((group) => (
              <section
                key={group.family ?? "other"}
                className="use-case-family"
                aria-labelledby={group.family ? `family-${group.family}` : undefined}
              >
                {group.family && (
                  <h3 id={`family-${group.family}`} className="use-case-family__title">
                    {t(`calculator.families.${group.family}`, { defaultValue: group.family })}
                  </h3>
                )}
                <div className="use-case-family__list">
                  {group.useCases.map((useCase) => {
                    const state = cardStates[useCase.id];
                    if (!state) return null;
                    const usageRequest = request?.usages.find(
                      (u) => u.useCaseId === useCase.id,
                    );
                    const usageResult = result?.usages.find(
                      (u) => u.useCaseId === useCase.id,
                    );
                    return (
                      <UseCaseCard
                        key={useCase.id}
                        useCase={useCase}
                        availableProviderIds={Array.from(selectedProviders)}
                        providerId={state.providerId}
                        profileId={state.profileId}
                        frequency={state.frequency}
                        frequencyUnit={state.frequencyUnit}
                        parameters={state.parameters}
                        dailyImpacts={usageResult?.dailyImpacts ?? null}
                        pending={
                          !usageRequest ||
                          !usageResult ||
                          !isUsageResultCurrent(usageRequest, usageResult)
                        }
                        onChange={(next) =>
                          setCardStates((prev) => ({ ...prev, [useCase.id]: next }))
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div
          className={`calculator-section__col calculator-section__col--aside${
            calculating ? " calculator-results--pending" : ""
          }`}
          aria-busy={calculating || undefined}
        >
          {status === "error" && (
            <div className="calculator-results__error" role="alert">
              <p>{t("calculator.errorGeneric")}</p>
              <button type="button" onClick={retry}>
                {t("calculator.retry")}
              </button>
            </div>
          )}
          {result ? (
            <>
              <GwpSummary impact={result.individualAnnual.gwp} scope="individual" />
              <ImpactsGrid
                impacts={result.individualAnnual}
                title={t("calculator.resultIndividualAnnual")}
              />
              <Co2Equivalents
                equivalents={result.co2Equivalents}
                gwpKgCo2eq={result.individualAnnual.gwp?.max ?? 0}
              />
              <ProviderBreakdown shares={result.providerBreakdown} />
            </>
          ) : (
            status !== "error" && (
              <p className="calculator-results__loading">{t("calculator.calculating")}</p>
            )
          )}
        </div>
      </section>

      <section className="calculator-section">
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

        {result && (
          <div
            className={calculating ? "calculator-results--pending" : undefined}
            aria-busy={calculating || undefined}
          >
            <GwpSummary impact={result.enterpriseAnnual.gwp} scope="enterprise" />
            <ImpactsGrid
              impacts={result.enterpriseAnnual}
              title={t("calculator.resultEnterpriseAnnual")}
            />
          </div>
        )}
      </section>
    </div>
  );
}
