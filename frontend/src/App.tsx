import { Suspense, lazy } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalculatorPage } from "./pages/CalculatorPage";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { Footer } from "./components/Footer";

// Loaded when opened only, with their texts (GreenIT RWEB_0046).
const MethodologyPage = lazy(() => import("./pages/MethodologyPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const LegalNoticePage = lazy(() => import("./pages/LegalNoticePage"));

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
            <Route
              path="/methodologie"
              element={
                <Suspense fallback={null}>
                  <MethodologyPage />
                </Suspense>
              }
            />
            <Route
              path="/a-propos"
              element={
                <Suspense fallback={null}>
                  <AboutPage />
                </Suspense>
              }
            />
            <Route
              path="/mentions-legales"
              element={
                <Suspense fallback={null}>
                  <LegalNoticePage />
                </Suspense>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
