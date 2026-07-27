import React from "react";
import { PiFileTextLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function EgyediArajanlat() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiFileTextLight}
      accent="#059669"
      path="/egyedi-arajanlat-fuvarozas"
      metaTitle={t("pages.egyedi.metaTitle")}
      metaDescription={t("pages.egyedi.metaDescription")}
      eyebrow={t("pages.egyedi.eyebrow")}
      h1={t("pages.egyedi.h1")}
      intro={t("pages.egyedi.intro")}
      bullets={t("pages.egyedi.bullets")}
      faqItems={pickFaq(
        t,
        { id: "pricing_factors", aKey: "pages.egyedi.faqOverrides.pricing_factors.a" },
        "custom_quote",
        { id: "payment_terms", aKey: "pages.egyedi.faqOverrides.payment_terms.a" },
      )}
      testimonialNames={["Kovács Gábor", "Molnár Eszter", "Szabó Katalin"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.egyedi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                In practice, this most often means oversized or overweight cargo, machinery or equipment that
                must be transported upright, large volumes of goods requiring multiple runs, and cargo needing
                special attention during loading (fragile, non-palletized, or requiring custom securing). If any
                of this sounds like your shipment, you're in the right place.
              </p>
              <p>
                If you're not sure whether a particular shipment fits within our usual services, a few questions
                can help you decide: does it fit on a standard flatbed, or does it need a specialized body; does
                pickup/delivery require a lift gate or crane loading; and are there any route restrictions (e.g.
                a weight-limited bridge, a narrow entrance) we need to plan for in advance. The quote we put
                together for you is based on the answers to exactly these questions.
              </p>
            </>
          ) : (
            <>
              <p>
                A gyakorlatban ez leggyakrabban azt jelenti, hogy vállalunk
                túlméretes vagy túlsúlyos rakományt, állóhelyzetben szállítandó
                gépet vagy berendezést, több fordulóban szállítandó, nagy
                mennyiségű tételt, valamint olyan árut, ami rakodás közben
                különleges figyelmet igényel (törékeny, nem raklapozható, vagy
                egyedi rögzítést igénylő). Ha bármelyik ismerősen hangzik az Ön
                szállítmányára, jó helyen jár.
              </p>
              <p>
                Ha bizonytalan, hogy egy adott rakomány beleillik-e a szokásos
                szolgáltatásainkba, néhány kérdés segít eldönteni: elfér-e egy
                szabványos kamionplatón vagy speciális felépítmény kell hozzá,
                igényel-e emelőhátfalat vagy darus rakodást a fel-/lerakodáshoz,
                és van-e olyan útvonal-korlátozás (pl. súlykorlátozott híd,
                keskeny bejárat), amit előre figyelembe kell vennünk. Ezekre a
                válaszokra épül az ajánlatkérésnél összeállított pontos árajánlat.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
