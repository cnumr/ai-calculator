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

interface ProviderLogoProps {
  providerId: string;
  /** Provider name: its initial is shown when there is no logo. */
  label: string;
  className: string;
  fallbackClassName: string;
}

/**
 * Decorative provider logo: the provider name is always written next to it,
 * so the logo is hidden from assistive technologies.
 */
export function ProviderLogo({
  providerId,
  label,
  className,
  fallbackClassName,
}: ProviderLogoProps) {
  const logo = PROVIDER_LOGOS[providerId];
  return logo ? (
    <img src={logo} alt="" aria-hidden="true" className={className} />
  ) : (
    <span className={fallbackClassName} aria-hidden="true">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
