import { useTranslation } from "react-i18next";

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("about.title")}</h1>
      <p>{t("about.body")}</p>
    </div>
  );
}
