import React from "react";
import { Link } from "react-router-dom";
import Footer from "components/Footers/Footer.js";
import Breadcrumb from "components/Landing/Breadcrumb.js";
import { useSeo } from "utils/useSeo.js";
import { useTranslation, localizePath } from "i18n/index.js";

// Adatvédelmi tájékoztató — elsősorban az ajánlatkérő/sofőr-jelentkezési
// formok GDPR-hozzájárulási jelölőnégyzete hivatkozik erre az oldalra
// (ld. components/Landing/QuoteForm.js). A szöveg a jelenleg ténylegesen
// kezelt adatkörre épül (name/email/phone/message a sendAjanlatkeres és
// sendJelentkezes backend actionökből, ld. backend/ApiHandler.php
// saveAjanlatkeres() és backend/interface/emailInterface.php) — nem
// tartalmaz olyan adatkezelést, ami a kódban ne létezne. Az angol verzió
// (ld. src/i18n/en.js `adatvedelem`) ugyanezt a tartalmat fordítja, ugyanazzal
// a "nem jogi felülvizsgálat alatt álló sablon" figyelmeztetéssel.
// Stabil objektum-referencia a hreflang-alternatívákhoz — statikus (nem függ
// propoktól/state-től), ezért modul-szinten hozzuk létre; `localizePath`
// adja a HU→EN leképezést, hogy ne legyen kézzel felírt "/en" string.
const ADATVEDELEM_ALTERNATES = {
  hu: localizePath("/adatvedelem", "hu"),
  en: localizePath("/adatvedelem", "en"),
};

export default function Adatvedelem() {
  const { t, locale } = useTranslation();
  const breadcrumbItems = [
    { name: t("adatvedelem.breadcrumbLabel"), path: localizePath("/adatvedelem", locale) },
  ];
  useSeo({
    title: t("adatvedelem.metaTitle"),
    description: t("adatvedelem.metaDescription"),
    path: localizePath("/adatvedelem", locale),
    lang: locale,
    alternates: ADATVEDELEM_ALTERNATES,
    breadcrumb: breadcrumbItems,
  });

  return (
    <div className="font-sans min-h-screen bg-[#F2F3F5]">
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to={localizePath("/", locale)}>
            <img src="/logo2.svg" alt="Szikora Transz Kft" width="1600" height="578" className="h-9 w-auto" />
          </Link>
          <Link
            to={localizePath("/", locale)}
            className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
          >
            {t("adatvedelem.backLink")}
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <Breadcrumb
          items={breadcrumbItems}
          homeLabel={t("landing.breadcrumbHome")}
          homePath={localizePath("/", locale)}
          navLabel={t("landing.breadcrumbNavLabel")}
        />
        <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8] mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E3AA8]"></span>
          {t("adatvedelem.eyebrow")}
        </span>
        <h1 className="font-[Overpass] font-extrabold text-4xl text-[#23262B] tracking-tight mb-6">
          {t("adatvedelem.h1")}
        </h1>

        <div className="prose prose-p:text-[#23262B]/75 prose-headings:text-[#23262B] max-w-none space-y-8 text-[#23262B]/75 leading-relaxed">
          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section1.heading")}
            </h2>
            {locale === "en" ? (
              <p>
                Szikora Transz Kft. (2518 Leányvár, Bécsi út 86, Hungary; tax number: 26381626-2-11, e-mail:{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                ) processes the personal data provided when filling out the quote-request and
                driver-application forms on its website (szikora-transz.hu) as described below.
              </p>
            ) : (
              <p>
                Szikora Transz Kft. (2518 Leányvár, Bécsi út 86, adószám:
                26381626-2-11, e-mail:{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                ) az alábbiak szerint kezeli a weboldalon (szikora-transz.hu)
                található ajánlatkérő és sofőr-jelentkezési űrlapok
                kitöltésekor megadott személyes adatokat.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section2.heading")}
            </h2>
            <p>{t("adatvedelem.section2.intro")}</p>
            <ul className="list-disc pl-6 space-y-1">
              {t("adatvedelem.section2.items").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section3.heading")}
            </h2>
            <p>{t("adatvedelem.section3.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section4.heading")}
            </h2>
            <p>{t("adatvedelem.section4.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section5.heading")}
            </h2>
            <p>{t("adatvedelem.section5.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section6.heading")}
            </h2>
            <p>{t("adatvedelem.section6.intro")}</p>
            <ul className="list-disc pl-6 space-y-1">
              {t("adatvedelem.section6.items").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {locale === "en" ? (
              <p>
                For matters related to these rights, please contact us at{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                .
              </p>
            ) : (
              <p>
                Ezen jogaival kapcsolatban forduljon hozzánk a{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>{" "}
                címen.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section7.heading")}
            </h2>
            <p>{t("adatvedelem.section7.body")}</p>
          </section>

          <p className="text-xs text-[#23262B]/40 pt-6 border-t border-[#23262B]/10">
            {t("adatvedelem.footerDisclaimer")}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
