import { useTranslation } from "react-i18next";
import type { Impacts, UseCase } from "../api/client";
import { RangeGauge } from "./RangeGauge";
import { ImpactIcon, isImpactCriterion } from "./ImpactIcon";
import { scaleImpacts } from "../domain/aggregate";
import { resolveSelection } from "../domain/calculator";
import { formatNumber, scaleRange } from "../domain/units";
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
  onChange: (next: {
    providerId: string;
    profileId: string;
    frequencyPerDay: number;
  }) => void;
}

export function UseCaseCard({
  useCase,
  availableProviderIds,
  providerId,
  profileId,
  frequencyPerDay,
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
  const scaledImpacts = currentProfile
    ? scaleImpacts(currentProfile.impacts, frequencyPerDay)
    : null;

  // Optional per-use-case caveat about where its impact values come from.
  const dataNote = t(`useCases.${useCase.id}.dataNote`, { defaultValue: "" });

  const inputIdPrefix = `use-case-${useCase.id}`;

  return (
    <article className="use-case-card">
      <header className="use-case-card__header">
        {USE_CASE_ICONS[useCase.id] && (
          <img src={USE_CASE_ICONS[useCase.id]} alt="" role="img" />
        )}
        <div>
          <h3>{t(`useCases.${useCase.id}.name`)}</h3>
          <p className="use-case-card__subtitle">
            {t(useCase.subtitleKey ?? `useCases.${useCase.id}.subtitle`, { defaultValue: "" })}
          </p>
        </div>
      </header>

      {!currentMapping || profiles.length === 0 ? (
        <p className="use-case-card__unsupported">
          {t("calculator.profileUnsupported")}
        </p>
      ) : (
        <>
          <div className="use-case-card__form">
            <div className="use-case-card__field">
              <label htmlFor={`${inputIdPrefix}-provider`}>
                {t("calculator.providerSelect")}
              </label>
              <select
                id={`${inputIdPrefix}-provider`}
                value={currentMapping.providerId}
                onChange={(e) => {
                  const nextMapping = offeredProviders.find(
                    (pm) => pm.providerId === e.target.value,
                  );
                  const nextProfileId = nextMapping?.profiles[0]?.id ?? "";
                  onChange({
                    providerId: e.target.value,
                    profileId: nextProfileId,
                    frequencyPerDay,
                  });
                }}
              >
                {offeredProviders.map((pm) => (
                  <option key={pm.providerId} value={pm.providerId}>
                    {t(`providers.${pm.providerId}`, {
                      defaultValue: pm.providerId,
                    })}
                  </option>
                ))}
              </select>
            </div>

            <div className="use-case-card__field">
              <label htmlFor={`${inputIdPrefix}-profile`}>
                {t("calculator.profileSelect")}
              </label>
              <select
                id={`${inputIdPrefix}-profile`}
                value={currentProfile?.id ?? ""}
                onChange={(e) =>
                  onChange({
                    providerId: currentMapping.providerId,
                    profileId: e.target.value,
                    frequencyPerDay,
                  })
                }
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {t(`calculator.tier.${profile.id}`, {
                      defaultValue: profile.id,
                    })}
                  </option>
                ))}
              </select>
            </div>

            <div className="use-case-card__field">
              <label htmlFor={`${inputIdPrefix}-frequency`}>
                {t("calculator.frequencyPerDay")}
              </label>
              <input
                id={`${inputIdPrefix}-frequency`}
                type="number"
                min={0}
                value={frequencyPerDay}
                onChange={(e) =>
                  onChange({
                    providerId: currentMapping.providerId,
                    profileId: currentProfile?.id ?? "",
                    frequencyPerDay: Number(e.target.value),
                  })
                }
              />
            </div>
            <p className="use-case-card__profile-hint">
              {t(`calculator.profileHint.${currentProfile?.id}`, { defaultValue: "" })}
            </p>
          </div>

          {scaledImpacts && (
            <div className="use-case-card__primary-impacts">
              <dl className="use-case-card__summary">
                {SUMMARY_CRITERIA.map(({ key, unit }) => {
                  const range = scaledImpacts[key];
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
                        {value
                          ? `${formatNumber((value.min + value.max) / 2, locale)} ${value.unit}`
                          : t("calculator.notAvailable")}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {dataNote && (
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
                  <span>{dataNote}</span>
                </p>
              )}
            </div>
          )}

          {scaledImpacts && (
            <details className="use-case-card__details">
              <summary>{t("calculator.detailsToggle")}</summary>
              {CRITERIA.map(({ key, unit }) => {
                const value = scaledImpacts[key];
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
