import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div>
      <button onClick={() => i18n.changeLanguage("fr")}>FR</button>
      <button onClick={() => i18n.changeLanguage("en")}>EN</button>
    </div>
  );
}
