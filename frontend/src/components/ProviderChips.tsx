import { useTranslation } from "react-i18next";
import type { CatalogProvider } from "../api/client";
import { ProviderLogo } from "./ProviderLogo";

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
              <ProviderLogo
                providerId={provider.id}
                label={label}
                className="provider-chips__logo"
                fallbackClassName="provider-chips__logo-fallback"
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
