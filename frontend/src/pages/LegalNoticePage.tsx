import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import i18next from "../i18n";
import legalFr from "../i18n/legal.fr.json";
import legalEn from "../i18n/legal.en.json";

// This page is loaded on demand (see App.tsx), its texts with it: they cost
// nothing to visitors who never open it (GreenIT RWEB_0046).
i18next.addResourceBundle("fr", "legal", legalFr);
i18next.addResourceBundle("en", "legal", legalEn);

const CONTACT_URL = "https://greenit.eco/contact/";
const HOST_URL = "https://www.infomaniak.com/";
const GITHUB_URL = "https://github.com/cnumr/ai-calculator";
const ISSUES_URL = "https://github.com/cnumr/ai-calculator/issues";
const CNIL_URL = "https://www.cnil.fr/";

/**
 * A paragraph whose <anchor> (and optional <cnil>) tags become links. Not
 * <link>: Trans parses it as the void HTML element and drops its text.
 */
function Text({ k, href }: { k: string; href: string }) {
  const { t } = useTranslation("legal");
  const anchor = href.startsWith("/") ? <Link to={href} /> : <a href={href} />;
  return (
    <p>
      <Trans t={t} i18nKey={k} components={{ anchor, cnil: <a href={CNIL_URL} /> }} />
    </p>
  );
}

/** One section, titled, with an id so that it can be linked to. */
function Section({ id, children }: { id: string; children: ReactNode }) {
  const { t } = useTranslation("legal");
  return (
    <section id={id} aria-labelledby={`legal-${id}`}>
      <h2 id={`legal-${id}`}>{t(`${id}.title`)}</h2>
      {children}
    </section>
  );
}

export default function LegalNoticePage() {
  const { t } = useTranslation("legal");
  return (
    <div className="page-prose">
      <h1>{t("title")}</h1>
      <p className="page-prose__meta">{t("updated")}</p>

      <Section id="publisher">
        <p>{t("publisher.intro")}</p>
        <ul>
          <li>{t("publisher.name")}</li>
          <li>{t("publisher.ids")}</li>
          <li>{t("publisher.office")}</li>
          <li>{t("publisher.phone")}</li>
          <li>
            <Trans t={t} i18nKey="publisher.contact" components={{ anchor: <a href={CONTACT_URL} /> }} />
          </li>
        </ul>
        <p>{t("publisher.director")}</p>
      </Section>

      <Section id="host">
        <Text k="host.body" href={HOST_URL} />
      </Section>

      <Section id="design">
        <Text k="design.body" href={GITHUB_URL} />
      </Section>

      <Section id="ip">
        <p>{t("ip.code")}</p>
        <Text k="ip.data" href="/methodologie" />
        <p>{t("ip.fonts")}</p>
        <p>{t("ip.brands")}</p>
      </Section>

      <Section id="results">
        <Text k="results.body" href="/methodologie" />
      </Section>

      <Section id="privacy">
        <p>{t("privacy.none")}</p>
        <p>{t("privacy.inputs")}</p>
        <p>{t("privacy.files")}</p>
        <p>{t("privacy.storage")}</p>
        <p>{t("privacy.logs")}</p>
        <Text k="privacy.rights" href={CONTACT_URL} />
      </Section>

      <Section id="links">
        <p>{t("links.body")}</p>
      </Section>

      <Section id="contact">
        <Text k="contact.privacy" href={CONTACT_URL} />
        <Text k="contact.issues" href={ISSUES_URL} />
      </Section>
    </div>
  );
}
