import React from "react";
import { PiLightningLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function ExpresszFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiLightningLight}
      accent="#D97706"
      path="/expressz-fuvarozas"
      metaTitle={t("pages.expressz.metaTitle")}
      metaDescription={t("pages.expressz.metaDescription")}
      eyebrow={t("pages.expressz.eyebrow")}
      h1={t("pages.expressz.h1")}
      intro={t("pages.expressz.intro")}
      bullets={t("pages.expressz.bullets")}
      faqItems={pickFaq(
        t,
        { id: "response_time", aKey: "pages.expressz.faqOverrides.response_time.a" },
        { id: "pricing_factors", aKey: "pages.expressz.faqOverrides.pricing_factors.a" },
        { id: "custom_quote", aKey: "pages.expressz.faqOverrides.custom_quote.a" },
      )}
      testimonialNames={["Farkas Zoltán", "Kovács Gábor", "Nagy Péter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.expressz.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                "Guaranteed delivery time" means we commit to a specific time or time window agreed together
                when you request your quote — not a rough estimate. Before we confirm an urgent job, we always
                double-check that the requested deadline is actually achievable on that route and with our
                current capacity — so we never promise something we can't deliver on.
              </p>
              <p>
                If anything unexpected comes up during transport (e.g. traffic delays), we proactively let you
                know — you won't have to chase us for updates. For urgent cases, it's best to call us directly
                for the fastest possible coordination, rather than just filling out the form.
              </p>
              <p>
                We confirm the agreed time in writing (by email) as well, so the arrangement is clear to both
                sides — this holds even under time pressure, not just for more relaxed scheduling.
              </p>
            </>
          ) : (
            <>
              <p>
                A "garantált kiszállítási idő" azt jelenti, hogy az ajánlatkérés
                során közösen egyeztetett, konkrét időpontot vagy időablakot
                vállaljuk — nem egy hozzávetőleges becslést. Mielőtt
                visszaigazolnánk egy sürgős megbízást, mindig leellenőrizzük,
                hogy a kért határidő ténylegesen tartható-e az adott útvonalon
                és a pillanatnyi kapacitásunk mellett — így nem ígérünk olyat,
                amit utólag nem tudunk tartani.
              </p>
              <p>
                Szállítás közben, ha bármi váratlan közbejön (pl. forgalmi
                torlódás), proaktívan jelzünk, nem Önnek kell utánaérdeklődnie.
                Sürgős esetben a leggyorsabb egyeztetés érdekében érdemes
                közvetlenül telefonon hívni minket, nem csak az űrlapot
                kitölteni.
              </p>
              <p>
                A vállalt időpontot írásban (e-mailben) is visszaigazoljuk, hogy
                mindkét fél számára egyértelmű legyen a megállapodás — ez sürgős
                helyzetben is megmarad, nem csak a nyugodtabb ütemezésű
                fuvaroknál.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
