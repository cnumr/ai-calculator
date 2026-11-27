import { useEffect, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import i18next from "../i18n";
import methodologyFr from "../i18n/methodology.fr.json";
import methodologyEn from "../i18n/methodology.en.json";

// This page is loaded on demand (see App.tsx), its texts with it: they cost
// nothing to visitors who never open it (GreenIT RWEB_0046).
i18next.addResourceBundle("fr", "methodology", methodologyFr);
i18next.addResourceBundle("en", "methodology", methodologyEn);

const ECOLOGITS_API_URL = "https://api.ecologits.ai/docs";
const ECOLOGITS_CALCULATOR_URL = "https://calculator.ecologits.ai/";
const ECOLOGITS_METHODOLOGY_URL = "https://ecologits.ai/latest/methodology/";
const ECOLOGITS_IMPACTS_URL = "https://ecologits.ai/latest/tutorial/impacts/";
const BASE_EMPREINTE_URL = "https://base-empreinte.ademe.fr/";
const IMAGE_STUDY_URL = "https://arxiv.org/abs/2506.17016";

const FREQUENCY_UNITS = ["day", "week", "month"] as const;

/**
 * Summary table rows. Tokens and image divisors mirror the back-end catalog
 * (backend/src/ai_calculator/data/use_cases.yaml), which does the computing.
 */
type SummaryRow = {
  useCase: string;
  /** Comment key under summary.comments, or a literal size / resolution. */
  comment?: string;
  detail?: string;
  tokens?: number;
  range?: [number, number];
  /** Key under summary.sources. */
  source: string;
  divisor?: number;
};

const SUMMARY_ROWS: SummaryRow[] = [
  { useCase: "doc_small", comment: "doc_small", tokens: 2000, range: [1500, 3000], source: "doc_small" },
  { useCase: "doc_large", comment: "doc_large", tokens: 5000, source: "ecologits" },
  { useCase: "email", comment: "email", tokens: 300, range: [150, 500], source: "custom" },
  { useCase: "email_long", comment: "email_long", tokens: 1000, range: [500, 1800], source: "custom" },
  { useCase: "deep_research", comment: "deep_research", tokens: 5000, source: "deep_research" },
  { useCase: "meet_summary", comment: "meet_summary", tokens: 1200, range: [800, 2000], source: "meet_summary" },
  { useCase: "ai_query", comment: "ai_query", tokens: 250, source: "ecologits" },
  { useCase: "slides", comment: "slides", tokens: 2000, source: "custom" },
  { useCase: "spreadsheet", comment: "spreadsheet", tokens: 2500, range: [1000, 5000], source: "custom" },
  { useCase: "video", detail: "720p", source: "ecologits" },
  { useCase: "video", detail: "1080p", source: "ecologits" },
  { useCase: "video", detail: "4K", source: "ecologits" },
  { useCase: "image", detail: "1024 × 1024", source: "image", divisor: 30 },
  { useCase: "image", detail: "2048 × 2048", source: "image", divisor: 8 },
  { useCase: "dev_assistance", comment: "dev_assistance", tokens: 100000, source: "ecologits" },
];

/** Energy per image size, from the study (the 512 px row is context only). */
const IMAGE_ENERGY = [
  { size: "512", label: "512 × 512", wh: 0.3 },
  { size: "1024", label: "1024 × 1024", wh: 1.5 },
  { size: "2048", label: "2048 × 2048", wh: 5 },
] as const;

/** Image sizes offered, with the factor applied to the reference video. */
const IMAGE_FACTORS = [
  { size: "1024 × 1024", divisor: 30 },
  { size: "2048 × 2048", divisor: 8 },
] as const;

/** An external link, opening in a new tab: the <anchor> of a Trans text. */
function External({ href, children }: { href: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="visually-hidden"> ({t("calculator.newTab")})</span>
    </a>
  );
}

/** A text whose <anchor> tag becomes a link (a #fragment stays in the page). */
function Linked({ k, href, values }: { k: string; href: string; values?: Record<string, unknown> }) {
  const { t } = useTranslation("methodology");
  const anchor = href.startsWith("#") ? <a href={href} /> : <External href={href} />;
  return <Trans t={t} i18nKey={k} values={values} components={{ anchor, strong: <strong /> }} />;
}

/** One section, titled, with an id so that it can be linked to. */
function Section({ id, k, children }: { id: string; k: string; children: ReactNode }) {
  const { t } = useTranslation("methodology");
  return (
    <section id={id} aria-labelledby={`methodology-${id}`}>
      <h2 id={`methodology-${id}`}>{t(`${k}.title`)}</h2>
      {children}
    </section>
  );
}

export default function MethodologyPage() {
  const { t, i18n } = useTranslation("methodology");
  const { t: tMain } = useTranslation();
  const { hash } = useLocation();
  const number = (value: number) => value.toLocaleString(i18n.language);

  // Links such as /methodologie#images open the page on that section.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="page-prose">
      <h1>{t("title")}</h1>

      <Section id="cas-usage" k="useCases">
        <p>{t("useCases.body")}</p>
        <p>{t("useCases.cumulative")}</p>
      </Section>

      <Section id="frequence" k="frequency">
        <p>{t("frequency.principle")}</p>
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <thead>
              <tr>
                <th scope="col">{t("frequency.unit")}</th>
                <th scope="col">{t("frequency.perYear")}</th>
                <th scope="col">{t("frequency.perDay")}</th>
              </tr>
            </thead>
            <tbody>
              {FREQUENCY_UNITS.map((unit) => {
                const cells = t(`frequency.rows.${unit}`, { returnObjects: true }) as string[];
                return (
                  <tr key={unit}>
                    {cells.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>{t("frequency.example")}</p>
      </Section>

      <Section id="facteurs" k="factors">
        <p>
          <Linked k="factors.intro" href={ECOLOGITS_API_URL} />
        </p>
        <ul>
          <li>{t("factors.direct")}</li>
          <li>
            {t("factors.custom")}
            <ul>
              <li>{t("factors.customTokens")}</li>
              <li>{t("factors.customRange")}</li>
            </ul>
          </li>
          <li>
            <Linked k="factors.image" href="#images" />
          </li>
        </ul>
      </Section>

      <Section id="mix" k="mix">
        <p>
          <Linked k="mix.body" href={BASE_EMPREINTE_URL} />
        </p>
      </Section>

      <Section id="limites" k="limits">
        <p>
          <Linked k="limits.scope" href={ECOLOGITS_METHODOLOGY_URL} />
        </p>
        <p>{t("limits.inputs")}</p>
        <p>
          <strong>{t("limits.conclusion")}</strong>
        </p>
      </Section>

      <Section id="synthese" k="summary">
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <caption className="visually-hidden">{t("summary.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("summary.useCase")}</th>
                <th scope="col">{t("summary.comment")}</th>
                <th scope="col">{t("summary.tokens")}</th>
                <th scope="col">{t("summary.range")}</th>
                <th scope="col">{t("summary.source")}</th>
              </tr>
            </thead>
            <tbody>
              {SUMMARY_ROWS.map((row) => (
                <tr key={`${row.useCase}-${row.detail ?? ""}`}>
                  <th scope="row">{tMain(`useCases.${row.useCase}.name`)}</th>
                  <td>{row.comment ? t(`summary.comments.${row.comment}`) : row.detail}</td>
                  <td>{row.tokens ? number(row.tokens) : t("summary.notApplicable")}</td>
                  <td>
                    {row.range
                      ? t("summary.rangeValue", { min: number(row.range[0]), max: number(row.range[1]) })
                      : t("summary.notApplicable")}
                  </td>
                  <td>{t(`summary.sources.${row.source}`, { divisor: row.divisor })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="images" k="images">
        <p>{t("images.principle")}</p>
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <thead>
              <tr>
                <th scope="col">{t("images.size")}</th>
                <th scope="col">{t("images.energy")}</th>
                <th scope="col">{t("images.assumptions")}</th>
              </tr>
            </thead>
            <tbody>
              {IMAGE_ENERGY.map(({ size, label, wh }) => (
                <tr key={size}>
                  <th scope="row">{label}</th>
                  <td className="methodology-table__nowrap">{number(wh)} Wh</td>
                  <td>{t(`images.rows.${size}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <Linked k="images.study" href={IMAGE_STUDY_URL} />
        </p>
        <p>{t("images.formats")}</p>
        <p>
          <Linked k="images.reference" href={ECOLOGITS_CALCULATOR_URL} />
        </p>
        <ul>
          {IMAGE_FACTORS.map(({ size, divisor }) => (
            <li key={size}>
              <Linked k="images.factor" href={ECOLOGITS_CALCULATOR_URL} values={{ size, divisor }} />
            </li>
          ))}
        </ul>
        <p>{t("images.scope")}</p>
      </Section>

      <Section id="sources" k="sources">
        <ul>
          <li>
            <Linked k="sources.methodology" href={ECOLOGITS_METHODOLOGY_URL} />
          </li>
          <li>
            <Linked k="sources.impacts" href={ECOLOGITS_IMPACTS_URL} />
          </li>
        </ul>
      </Section>
    </div>
  );
}
