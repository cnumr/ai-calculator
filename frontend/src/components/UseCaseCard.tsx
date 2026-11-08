import { useTranslation } from "react-i18next";
import type {
  Impacts,
  ParameterValue,
  Profile,
  ProfileParameter,
  UseCase,
} from "../api/client";
import { RangeGauge } from "./RangeGauge";
import { ImpactIcon, isImpactCriterion } from "./ImpactIcon";
import { ProviderLogo } from "./ProviderLogo";
import {
  CardState,
  resolveParameters,
  resolveSelection,
} from "../domain/calculator";
import { formatInteger, formatNumber, scaleRange } from "../domain/units";
import videoIcon from "../assets/use-cases/video.svg";
import imageIcon from "../assets/use-cases/image.svg";
import deepResearchIcon from "../assets/use-cases/deep_research.svg";
import meetSummaryIcon from "../assets/use-cases/meet_summary.svg";
import docSmallIcon from "../assets/use-cases/doc_small.svg";
import docLargeIcon from "../assets/use-cases/doc_large.svg";
import aiQueryIcon from "../assets/use-cases/ai_query.svg";
import emailIcon from "../assets/use-cases/email.svg";

const USE_CASE_ICONS: Record<string, string> = {
  video: videoIcon,
  image: imageIcon,
  deep_research: deepResearchIcon,
  meet_summary: meetSummaryIcon,
  doc_small: docSmallIcon,
  doc_large: docLargeIcon,
  ai_query: aiQueryIcon,
  email: emailIcon,
};

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

const SUMMARY_CRITERIA: Array<{ key: "gwp" | "water"; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "water", unit: "L" },
];

interface UseCaseCardProps {
  useCase: UseCase;
  availableProviderIds: string[];
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
  /** Parameter values chosen by the user (see CardState.parameters). */
  parameters?: Record<string, ParameterValue>;
  /**
   * Impacts for the day (one action × frequency), computed by the backend;
   * null before the first calculation.
   */
  dailyImpacts?: Impacts | null;
  /** True while the shown impacts do not match the current selection yet. */
  pending?: boolean;
  onChange: (next: CardState) => void;
}

export function UseCaseCard({
  useCase,
  availableProviderIds,
  providerId,
  profileId,
  frequencyPerDay,
  parameters = {},
  dailyImpacts = null,
  pending = false,
  onChange,
}: UseCaseCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const {
    offeredProviders,
    mapping: currentMapping,
    profile: currentProfile,
  } = resolveSelection(useCase, availableProviderIds, {
    providerId,
    profileId,
  });
  const profiles = currentMapping?.profiles ?? [];
  const parameterValues = currentProfile
    ? resolveParameters(currentProfile, parameters)
    : {};
  const impacts = currentProfile ? dailyImpacts : null;
  const source = useCase.source;
  const inputIdPrefix = `use-case-${useCase.id}`;
  const customizable = currentProfile?.parameters ?? [];

  function optionLabel(parameterId: string, value: ParameterValue): string {
    if (parameterId === "duration_s") {
      return t("calculator.parameterOption.duration_s", {
        value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          Number(value),
        ),
      });
    }
    if (parameterId === "with_audio") {
      return t(`calculator.parameterOption.with_audio.${String(value)}`);
    }
    if (parameterId === "output_tokens") {
      return t("calculator.parameterOption.output_tokens", {
        value: formatInteger(Number(value), locale),
      });
    }
    return String(value);
  }

  function profileLabel(profile: Profile): string {
    const tier = t(`calculator.tier.${profile.id}`, { defaultValue: profile.id });
    const models = profile.models ?? [];
    return models.length > 0 ? `${tier} (${models.join(", ")})` : tier;
  }

  function emit(next: Partial<CardState>) {
    onChange({
      providerId: currentMapping?.providerId ?? providerId,
      profileId: currentProfile?.id ?? profileId,
      frequencyPerDay,
      parameters,
      ...next,
    });
  }

  function setParameter(id: string, value: ParameterValue) {
    emit({ parameters: { ...parameters, [id]: value } });
  }

  function renderParameter(parameter: ProfileParameter) {
    const fieldId = `${inputIdPrefix}-parameter-${parameter.id}`;
    const label = t(`calculator.parameter.${parameter.id}`, {
      defaultValue: parameter.id,
    });
    if (parameter.options === null) {
      // Free integer (e.g. generated tokens): keep what the user types, even
      // while it is invalid; the calculation falls back to the default.
      const hintId = `${fieldId}-hint`;
      return (
        <div key={parameter.id} className="use-case-card__field">
          <label htmlFor={fieldId}>{label}</label>
          <input
            id={fieldId}
            type="number"
            min={parameter.min ?? undefined}
            max={parameter.max ?? undefined}
            step={1}
            value={String(parameters[parameter.id] ?? parameter.defaultValue)}
            aria-describedby={hintId}
            onChange={(e) =>
              setParameter(
                parameter.id,
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
          <p id={hintId} className="use-case-card__field-hint">
            {t("calculator.parameterDefault", {
              value: optionLabel(parameter.id, parameter.defaultValue),
            })}
          </p>
        </div>
      );
    }
    return (
      <div key={parameter.id} className="use-case-card__field">
        <label htmlFor={fieldId}>{label}</label>
        <select
          id={fieldId}
          value={String(parameter.options.indexOf(parameterValues[parameter.id]))}
          onChange={(e) =>
            setParameter(parameter.id, parameter.options![Number(e.target.value)])
          }
        >
          {parameter.options.map((option, index) => (
            <option key={String(option)} value={String(index)}>
              {optionLabel(parameter.id, option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <article
      className={`use-case-card${pending ? " use-case-card--pending" : ""}`}
      aria-busy={pending || undefined}
    >
      <header className="use-case-card__header">
        {USE_CASE_ICONS[useCase.id] && (
          <img src={USE_CASE_ICONS[useCase.id]} alt="" role="img" />
        )}
        <div className="use-case-card__title">
          <h3>{t(`useCases.${useCase.id}.name`)}</h3>
          <p className="use-case-card__subtitle">
            {t(useCase.subtitleKey ?? `useCases.${useCase.id}.subtitle`, { defaultValue: "" })}
          </p>
        </div>
      </header>

      {!currentMapping || !currentProfile ? (
        <p className="use-case-card__unsupported">
          {t("calculator.profileUnsupported")}
        </p>
      ) : (
        <>
          {/* Provider, profile and frequency on one row. */}
          <div className="use-case-card__selects">
            <div className="use-case-card__field">
              <label htmlFor={`${inputIdPrefix}-provider`}>
                {t("calculator.providerSelect")}
              </label>
              <div className="use-case-card__provider">
                <ProviderLogo
                  providerId={currentMapping.providerId}
                  label={t(`providers.${currentMapping.providerId}`, {
                    defaultValue: currentMapping.providerId,
                  })}
                  className="use-case-card__provider-logo"
                  fallbackClassName="use-case-card__provider-logo use-case-card__provider-logo--fallback"
                />
                <select
                  id={`${inputIdPrefix}-provider`}
                  value={currentMapping.providerId}
                  onChange={(e) => {
                    const nextMapping = offeredProviders.find(
                      (pm) => pm.providerId === e.target.value,
                    );
                    emit({
                      providerId: e.target.value,
                      profileId: nextMapping?.profiles[0]?.id ?? "",
                    });
                  }}
                >
                  {offeredProviders.map((pm) => (
                    <option key={pm.providerId} value={pm.providerId}>
                      {t(`providers.${pm.providerId}`, { defaultValue: pm.providerId })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="use-case-card__field">
              <label htmlFor={`${inputIdPrefix}-profile`}>
                {t("calculator.profileSelect")}
              </label>
              <select
                id={`${inputIdPrefix}-profile`}
                value={currentProfile.id}
                onChange={(e) => emit({ profileId: e.target.value })}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profileLabel(profile)}
                  </option>
                ))}
              </select>
            </div>

            <div className="use-case-card__field use-case-card__frequency">
              <label htmlFor={`${inputIdPrefix}-frequency`}>
                {t("calculator.frequencyPerDay")}
              </label>
              <div className="use-case-card__frequency-input">
                <input
                  id={`${inputIdPrefix}-frequency`}
                  type="number"
                  min={0}
                  value={frequencyPerDay}
                  onChange={(e) => emit({ frequencyPerDay: Number(e.target.value) })}
                />
                <span className="use-case-card__frequency-unit" aria-hidden="true">
                  {t("calculator.perDayShort")}
                </span>
              </div>
            </div>
          </div>

          {/* Results below, with the methodological source on the right. */}
          <div className="use-case-card__results">
            <dl className="use-case-card__summary">
              {SUMMARY_CRITERIA.map(({ key, unit }) => {
                const range = impacts ? impacts[key] : undefined;
                const value = range && scaleRange(range.min, range.max, unit);
                return (
                  <div key={key}>
                    <dt>
                      <ImpactIcon
                        criterion={key}
                        title={t(`calculator.cardImpactSummary.${key}`)}
                        className="use-case-card__summary-icon"
                      />
                    </dt>
                    <dd>
                      {range === undefined
                        ? "…"
                        : value
                          ? `${formatNumber((value.min + value.max) / 2, locale)} ${value.unit}`
                          : t("calculator.notAvailable")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {source && (
              <p className="use-case-card__data-note" role="note">
                <svg
                  className="use-case-card__data-note-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  {t(`calculator.source.${source.id}`, {
                    version: source.version ?? "",
                    defaultValue: "",
                  })}
                  {source.url && (
                    <>
                      {" "}
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {t("calculator.sourceLink")}{" "}
                        <span className="visually-hidden">
                          ({t("calculator.newTab")})
                        </span>
                      </a>
                    </>
                  )}
                </span>
              </p>
            )}
          </div>

          {customizable.length > 0 && (
            <details className="use-case-card__details use-case-card__customize">
              <summary>
                {t("calculator.customize", {
                  values: customizable
                    .map((parameter) =>
                      optionLabel(parameter.id, parameterValues[parameter.id]),
                    )
                    .join(" · "),
                })}
              </summary>
              <div className="use-case-card__parameters">
                {customizable.map(renderParameter)}
              </div>
            </details>
          )}

          {impacts && (
            <details className="use-case-card__details">
              <summary>{t("calculator.detailsToggle")}</summary>
              {CRITERIA.map(({ key, unit }) => {
                const value = impacts[key];
                const label = t(`calculator.criterion.${key}`);
                return value === null ? (
                  <p key={key} className="use-case-card__unavailable">
                    {label}: {t("calculator.notAvailable")}
                  </p>
                ) : (
                  <RangeGauge
                    key={key}
                    min={value.min}
                    max={value.max}
                    unit={unit}
                    label={
                      isImpactCriterion(key) ? (
                        <>
                          <ImpactIcon
                            criterion={key}
                            title={label}
                            className="impact-icon--detail use-case-card__detail-icon"
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
            </details>
          )}
        </>
      )}
    </article>
  );
}
