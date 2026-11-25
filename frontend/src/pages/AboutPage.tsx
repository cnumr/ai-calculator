import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import i18next from "../i18n";
import aboutFr from "../i18n/about.fr.json";
import aboutEn from "../i18n/about.en.json";

// This page is loaded on demand (see App.tsx), its texts with it: they cost
// nothing to visitors who never open it (GreenIT RWEB_0046).
i18next.addResourceBundle("fr", "about", aboutFr);
i18next.addResourceBundle("en", "about", aboutEn);

const GREENIT_URL = "https://greenit.eco/";
const CLAUDE_CODE_URL = "https://claude.com/claude-code";
const HISTORY_URL = "https://github.com/cnumr/ai-calculator/commits/main/";

// Proper names: the same in every language.
const DESIGNERS = ["Jérôme Gascoin", "David Heinzer", "Renaud Héluin", "Brice Pasian"];
const REVIEWERS = ["Laure Alfonsi", "Frédéric Bordage", "Sylvain Chery", "Raphaël Lemaire"];

/**
 * Claude Code use on this project, from scripts/ai-usage-total.py (changesets,
 * CHANGELOG.md and docs/ai-usage.csv, all contributors): output tokens of
 * Claude Opus 5.5 (1 077 546) and Haiku 5.5 (132 643). Impacts computed by
 * POST /api/calculate, use case dev_assistance (Anthropic, "powerful" and
 * "eco" profiles) with these output tokens; static figures, to update with
 * the usage.
 */
const CLAUDE_USAGE = {
  from: new Date(2026, 10, 8),
  to: new Date(2026, 10, 25),
  outputTokens: 1_210_189,
  sessions: 12.1,
};

const CLAUDE_IMPACTS = [
  { criterion: "gwp", min: 1.31, max: 2.49, unit: "kg CO2eq" },
  { criterion: "energy", min: 3.27, max: 6.34, unit: "kWh" },
  { criterion: "adpe", min: 3.39, max: 3.7, unit: "mg Sbeq" },
  { criterion: "pe", min: 32.3, max: 62.1, unit: "MJ" },
  { criterion: "water", min: 10.6, max: 25.4, unit: "L" },
] as const;

/** A list of people, under its heading. */
function People({ k, names }: { k: string; names: string[] }) {
  const { t } = useTranslation("about");
  return (
    <>
      <p>{t(k)}</p>
      <ul>
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </>
  );
}

/** An introductory sentence followed by its bullet list. */
function List({ id, items }: { id: string; items: string[] }) {
  const { t } = useTranslation("about");
  return (
    <>
      <p>{t(`${id}.intro`)}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{t(`${id}.${item}`)}</li>
        ))}
      </ul>
    </>
  );
}

export default function AboutPage() {
  const { t, i18n } = useTranslation("about");
  const { t: tMain } = useTranslation();
  const number = (value: number) => value.toLocaleString(i18n.language);
  const date = (value: Date) =>
    value.toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page-prose">
      <h1>{t("title")}</h1>
      <p>
        <Trans t={t} i18nKey="goal" components={{ strong: <strong /> }} />
      </p>

      <List id="audience" items={["public", "business"]} />
      <List id="existing" items={["technical", "perRequest", "targeted"]} />
      <List id="aims" items={["gaps", "annual"]} />
      <List id="business" items={["scale", "code"]} />

      <p>
        <Trans t={t} i18nKey="credits.intro" components={{ anchor: <a href={GREENIT_URL} /> }} />
      </p>
      <People k="credits.design" names={DESIGNERS} />
      <People k="credits.review" names={REVIEWERS} />

      <section aria-labelledby="about-claude">
        <h2 id="about-claude">{t("claude.title")}</h2>
        <p>
          <Trans t={t} i18nKey="claude.intro" components={{ anchor: <a href={CLAUDE_CODE_URL} /> }} />
        </p>
        <ul>
          <li>{t("claude.mcp")}</li>
          <li>{t("claude.practices")}</li>
        </ul>
        <p>
          {t("claude.usage", {
            from: date(CLAUDE_USAGE.from),
            to: date(CLAUDE_USAGE.to),
            tokens: number(CLAUDE_USAGE.outputTokens),
            sessions: number(CLAUDE_USAGE.sessions),
          })}
        </p>
        <ul>
          {CLAUDE_IMPACTS.map(({ criterion, min, max, unit }) => (
            <li key={criterion}>
              {t("claude.range", {
                label: tMain(`calculator.criterion.${criterion}`),
                min: number(min),
                max: number(max),
                unit,
              })}
            </li>
          ))}
        </ul>
        <p>
          <Trans
            t={t}
            i18nKey="claude.limits"
            components={{ anchor: <Link to="/methodologie#limites" /> }}
          />
        </p>
        <p>
          <Trans t={t} i18nKey="claude.history" components={{ anchor: <a href={HISTORY_URL} /> }} />
        </p>
      </section>
    </div>
  );
}
