import { useTranslation } from "react-i18next";
import type { CatalogProvider } from "../api/client";
import openaiLogo from "../assets/providers/openai.svg";
import anthropicLogo from "../assets/providers/anthropic.svg";
import mistralLogo from "../assets/providers/mistral.svg";
import googleLogo from "../assets/providers/google.svg";
import microsoftCopilotLogo from "../assets/providers/microsoft_copilot.svg";

const PROVIDER_LOGOS: Record<string, string> = {
  openai: openaiLogo,
  anthropic: anthropicLogo,
  mistral: mistralLogo,
  google: googleLogo,
  microsoft_copilot: microsoftCopilotLogo,
};

interface ProviderChipsProps {
  providers: CatalogProvider[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function ProviderChips({
  providers,
  selected,
  onToggle,
}: ProviderChipsProps) {
  const { t } = useTranslation();

  return (
    <div className="provider-chips">
      <h2 className="provider-chips__heading">
        {t("calculator.providersHeading")}
      </h2>
      <div className="provider-chips__list">
        {providers.map((provider) => {
          const logo = PROVIDER_LOGOS[provider.id];
          const label = t(`providers.${provider.id}`, {
            defaultValue: provider.id,
          });
          return (
            <button
              key={provider.id}
              type="button"
              className="provider-chips__chip"
              aria-pressed={selected.has(provider.id)}
              onClick={() => onToggle(provider.id)}
            >
              {logo ? (
                <img src={logo} alt="" className="provider-chips__logo" />
              ) : (
                <span className="provider-chips__logo-fallback">
                  {label.charAt(0).toUpperCase()}
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
