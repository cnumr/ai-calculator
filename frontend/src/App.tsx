import { Link, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalculatorPage } from "./pages/CalculatorPage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { AboutPage } from "./pages/AboutPage";
import { LegalNoticePage } from "./pages/LegalNoticePage";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export function App() {
  const { t } = useTranslation();
  return (
    <>
      <nav>
        <Link to="/">{t("nav.calculator")}</Link>
        <Link to="/methodologie">{t("nav.methodology")}</Link>
        <Link to="/a-propos">{t("nav.about")}</Link>
        <Link to="/mentions-legales">{t("nav.legal")}</Link>
        <LanguageSwitcher />
      </nav>
      <Routes>
        <Route path="/" element={<CalculatorPage />} />
        <Route path="/methodologie" element={<MethodologyPage />} />
        <Route path="/a-propos" element={<AboutPage />} />
        <Route path="/mentions-legales" element={<LegalNoticePage />} />
      </Routes>
    </>
  );
}
