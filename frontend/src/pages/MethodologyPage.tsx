import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

const IMAGE_STUDY_URL = "https://arxiv.org/abs/2506.17016";

/** Image sizes and the factor applied to the reference video (see use_cases.yaml). */
const IMAGE_SIZES = [
  { size: "1024 × 1024", divisor: 30, energyKey: "small" },
  { size: "2048 × 2048", divisor: 8, energyKey: "large" },
] as const;

export function MethodologyPage() {
  const { t } = useTranslation();
  const { hash } = useLocation();

  // Links such as /methodologie#images open the page on that section.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="page-prose">
      <h1>{t("methodology.title")}</h1>
      <p>{t("methodology.body")}</p>

      <section id="images" aria-labelledby="methodology-images">
        <h2 id="methodology-images">{t("methodology.images.title")}</h2>
        <p>{t("methodology.images.principle")}</p>
        <p>{t("methodology.images.reference")}</p>
        <table className="methodology-table">
          <thead>
            <tr>
              <th scope="col">{t("methodology.images.size")}</th>
              <th scope="col">{t("methodology.images.factor")}</th>
              <th scope="col">{t("methodology.images.energy")}</th>
            </tr>
          </thead>
          <tbody>
            {IMAGE_SIZES.map(({ size, divisor, energyKey }) => (
              <tr key={size}>
                <td>{size}</td>
                <td>{t("methodology.images.divisor", { divisor })}</td>
                <td>{t(`methodology.images.energyValue.${energyKey}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {t("methodology.images.study")}{" "}
          <a href={IMAGE_STUDY_URL} target="_blank" rel="noreferrer">
            {t("methodology.images.studyLink")}
            <span className="visually-hidden"> ({t("calculator.newTab")})</span>
          </a>
          .
        </p>
        <p>{t("methodology.images.scope")}</p>
      </section>
    </div>
  );
}
