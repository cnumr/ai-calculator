import { Trans, useTranslation } from "react-i18next";
import i18next from "../i18n";
import aboutFr from "../i18n/about.fr.json";
import aboutEn from "../i18n/about.en.json";

// This page is loaded on demand (see App.tsx), its texts with it: they cost
// nothing to visitors who never open it (GreenIT RWEB_0046).
i18next.addResourceBundle("fr", "about", aboutFr);
i18next.addResourceBundle("en", "about", aboutEn);

const GREENIT_URL = "https://greenit.eco/";

// Proper names: the same in every language.
const AUTHORS = ["Jérôme Gascoin", "David Heinzer", "Renaud Helluin", "Brice Pasian"];

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
  const { t } = useTranslation("about");
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
        <Trans t={t} i18nKey="credits" components={{ anchor: <a href={GREENIT_URL} /> }} />
      </p>
      <ul>
        {AUTHORS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
