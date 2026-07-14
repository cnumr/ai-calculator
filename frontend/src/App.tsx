import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalculatorPage } from "./pages/CalculatorPage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { AboutPage } from "./pages/AboutPage";
import { LegalNoticePage } from "./pages/LegalNoticePage";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export function App() {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <nav className="app-nav">
            <div className="app-nav__links">
              <NavLink to="/" end>
                {t("nav.calculator")}
              </NavLink>
              <NavLink to="/methodologie">{t("nav.methodology")}</NavLink>
              <NavLink to="/a-propos">{t("nav.about")}</NavLink>
              <NavLink to="/mentions-legales">{t("nav.legal")}</NavLink>
            </div>
            <LanguageSwitcher />
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<CalculatorPage />} />
            <Route path="/methodologie" element={<MethodologyPage />} />
            <Route path="/a-propos" element={<AboutPage />} />
            <Route path="/mentions-legales" element={<LegalNoticePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
