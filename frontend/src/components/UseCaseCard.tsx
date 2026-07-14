import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Impacts, UseCase } from "../api/client";
import { RangeGauge } from "./RangeGauge";
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
  onImpactsChange: (impacts: Impacts) => void;
}

export function UseCaseCard({
  useCase,
  availableProviderIds,
  providerId,
  profileId,
  frequencyPerDay,
  onChange,
  onImpactsChange,
}: UseCaseCardProps) {
  const { t } = useTranslation();

  const offeredProviders = useCase.providers.filter((pm) =>
    availableProviderIds.includes(pm.providerId),
  );
  const currentMapping =
    offeredProviders.find((pm) => pm.providerId === providerId) ??
    offeredProviders[0];
  const profiles = currentMapping?.profiles ?? [];
  const currentProfile =
    profiles.find((p) => p.id === profileId) ?? profiles[0];

  useEffect(() => {
    if (currentProfile) {
      onImpactsChange(currentProfile.impacts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMapping?.providerId, currentProfile?.id]);

  const inputIdPrefix = `use-case-${useCase.id}`;

  return (
    <article className="use-case-card">
      <header className="use-case-card__header">
        {USE_CASE_ICONS[useCase.id] && (
          <img src={USE_CASE_ICONS[useCase.id]} alt="" role="img" />
        )}
        <h3>{t(`useCases.${useCase.id}.name`)}</h3>
      </header>

      {!currentMapping || profiles.length === 0 ? (
        <p className="use-case-card__unsupported">
          {t("calculator.profileUnsupported")}
        </p>
      ) : (
        <>
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

          {currentProfile && (
            <details className="use-case-card__details">
              <summary>{t("calculator.detailsToggle")}</summary>
              {CRITERIA.map(({ key, unit }) => (
                <RangeGauge
                  key={key}
                  min={currentProfile.impacts[key].min}
                  max={currentProfile.impacts[key].max}
                  unit={unit}
                  label={t(`calculator.criterion.${key}`)}
                />
              ))}
            </details>
          )}
        </>
      )}
    </article>
  );
}
