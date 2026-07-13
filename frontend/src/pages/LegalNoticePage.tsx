import { useTranslation } from "react-i18next";

export function LegalNoticePage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("legal.title")}</h1>
      <p>{t("legal.body")}</p>
    </div>
  );
}
