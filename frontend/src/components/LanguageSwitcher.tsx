import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="app-nav__lang">
      <button
        aria-pressed={i18n.resolvedLanguage === "fr"}
        onClick={() => i18n.changeLanguage("fr")}
      >
        FR
      </button>
      <button
        aria-pressed={i18n.resolvedLanguage === "en"}
        onClick={() => i18n.changeLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
