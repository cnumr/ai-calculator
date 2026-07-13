import { useTranslation } from "react-i18next";

export function MethodologyPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("methodology.title")}</h1>
      <p>{t("methodology.body")}</p>
    </div>
  );
}
