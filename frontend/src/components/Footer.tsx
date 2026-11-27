import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DataSource } from "../api/client";
import { loadCatalog } from "../api/catalogStore";

const GREENIT_URL = "https://greenit.eco/";
const GITHUB_URL = "https://github.com/cnumr/ai-calculator";

function ExternalLink({ href, children }: { href: string; children: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${children} (${t("calculator.newTab")})`}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

/**
 * Ecoindex badge of the current page, relayed by our nginx (see
 * nginx.conf.template): no third-party request from the browser. Hidden when
 * the server has no badge for it (no ECOINDEX_DOMAIN, unknown page, or the dev
 * server without ECOINDEX_DOMAIN).
 */
function EcoindexBadge() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [failedPath, setFailedPath] = useState<string | null>(null);
  if (failedPath === pathname) return null;
  // Not encoded: nginx matches the path as is (map $arg_path).
  const query = `?path=${pathname}`;
  return (
    <a className="app-footer__ecoindex" href={`/ecoindex${query}`} target="_blank" rel="noreferrer">
      <img
        src={`/ecoindex-badge.svg${query}`}
        alt={`${t("footer.ecoindex")} (${t("calculator.newTab")})`}
        width={108}
        height={32}
        loading="lazy"
        onError={() => setFailedPath(pathname)}
      />
    </a>
  );
}

/**
 * Site footer: project links, site version, Ecoindex badge and the version of
 * the external data sources. The sources come from the catalogue already
 * loaded for the calculator: no extra request.
 */
export function Footer() {
  const { t, i18n } = useTranslation();
  const [sources, setSources] = useState<DataSource[]>([]);

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((catalog) => {
        if (active) setSources(catalog.dataSources ?? []);
      })
      // The calculator shows the loading error; the footer simply omits sources.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const formatDate = (isoDate: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${isoDate}T00:00:00Z`),
    );

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__about">
          <p className="app-footer__title">
            AI Calculator · <span className="app-footer__version">v{__APP_VERSION__}</span>
            <EcoindexBadge />
          </p>
          <p>
            <ExternalLink href={GREENIT_URL}>{t("footer.greenit")}</ExternalLink>
            {" · "}
            <ExternalLink href={GITHUB_URL}>{t("footer.github")}</ExternalLink>
          </p>
          {sources.length > 0 && (
            <p className="app-footer__sources">
              {t("footer.sources")}{" "}
              {sources.map((source, index) => (
                <span key={source.id}>
                  {index > 0 && " · "}
                  <ExternalLink href={source.url}>{source.name}</ExternalLink>
                  {source.version && ` ${source.version}`}
                  {source.retrievedOn &&
                    `, ${t("footer.retrievedOn", { date: formatDate(source.retrievedOn) })}`}
                </span>
              ))}
            </p>
          )}
        </div>
        <nav className="app-footer__nav" aria-label={t("footer.navLabel")}>
          <NavLink to="/methodologie">{t("nav.methodology")}</NavLink>
          <NavLink to="/a-propos">{t("nav.about")}</NavLink>
          <NavLink to="/mentions-legales">{t("nav.legal")}</NavLink>
        </nav>
      </div>
    </footer>
  );
}
