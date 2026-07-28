import React from "react";
import { PiGlobeLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function NemzetkoziFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiGlobeLight}
      accent="#0F766E"
      path="/nemzetkozi-fuvarozas-vamugyintezessel"
      metaTitle={t("pages.nemzetkozi.metaTitle")}
      metaDescription={t("pages.nemzetkozi.metaDescription")}
      eyebrow={t("pages.nemzetkozi.eyebrow")}
      h1={t("pages.nemzetkozi.h1")}
      intro={t("pages.nemzetkozi.intro")}
      bullets={t("pages.nemzetkozi.bullets")}
      faqItems={pickFaq(
        t,
        "international",
        { id: "insurance", aKey: "pages.nemzetkozi.faqOverrides.insurance.a" },
        { id: "damage", aKey: "pages.nemzetkozi.faqOverrides.damage.a" },
        { id: "payment_terms", aKey: "pages.nemzetkozi.faqOverrides.payment_terms.a" },
      )}
      testimonialNames={["Tóth Andrea", "Nagy Péter", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.nemzetkozi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Road freight transport within the EU, as well as to and from non-EU countries, is governed by
                international agreements and documentation. The most important of these is the{" "}
                <strong className="text-[#23262B]">CMR consignment note</strong> — the mandatory shipping
                document required under the CMR Convention (the international road freight contract), which
                records the details of the shipper, the carrier, and the consignee, the nature and quantity of
                the goods, and the extent of liability during transport.
              </p>
              <p>
                For destinations outside the EU, a <strong className="text-[#23262B]">commercial invoice</strong>{" "}
                and a <strong className="text-[#23262B]">packing list</strong> are also typically required for
                customs clearance — the exact requirements vary by country and cargo type, so we always clarify
                the documentation needed for your specific shipment individually, when you request a quote.
              </p>
              <p>
                We prepare the CMR consignment note and any other accompanying documentation your shipment
                needs — all you have to provide when requesting a quote is the exact details of the cargo and
                the destination.
              </p>
              <p className="text-sm text-[#23262B]/60">
                You can find more information on the official rules and procedures for customs clearance on the
                website of the{" "}
                <a
                  href="https://nav.gov.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F766E] underline hover:text-[#0B5B52] transition-colors duration-300"
                >
                  National Tax and Customs Administration of Hungary (NAV)
                </a>{" "}
                — for your international shipments, we handle the actual paperwork on your behalf.
              </p>
            </>
          ) : (
            <>
              <p>
                Az EU-n belüli, illetve EU-n kívüli országokat érintő közúti
                árufuvarozást nemzetközi egyezmények és okmányok szabályozzák.
                A legfontosabb ezek közül a{" "}
                <strong className="text-[#23262B]">CMR-fuvarlevél</strong> — a
                nemzetközi közúti árufuvarozási szerződés (CMR-egyezmény) által
                előírt, kötelező szállítási okmány, amely rögzíti a felrakó, a
                fuvarozó és a címzett adatait, az áru jellegét és mennyiségét,
                valamint a felelősség terjedelmét szállítás közben.
              </p>
              <p>
                EU-n kívüli célországok esetén ehhez jellemzően{" "}
                <strong className="text-[#23262B]">kereskedelmi számla</strong> és{" "}
                <strong className="text-[#23262B]">csomagolási jegyzék</strong>{" "}
                is szükséges a vámkezeléshez — ezek pontos köre országonként és
                árutípusonként eltérhet, ezért az adott fuvarhoz tartozó
                dokumentációs igényt mindig az ajánlatkérés során, egyedileg
                tisztázzuk Önnel.
              </p>
              <p>
                A CMR-fuvarlevelet és a szükséges kísérő dokumentációt
                fuvarjainknál mi állítjuk össze — Önnek csak az áru pontos
                adatait és a rendeltetési helyet kell megadnia az
                ajánlatkérésnél.
              </p>
              <p className="text-sm text-[#23262B]/60">
                A vámügyintézés hivatalos szabályairól és eljárásrendjéről a{" "}
                <a
                  href="https://nav.gov.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F766E] underline hover:text-[#0B5B52] transition-colors duration-300"
                >
                  Nemzeti Adó- és Vámhivatal (NAV)
                </a>{" "}
                hivatalos oldalán tájékozódhat bővebben — a konkrét ügyintézést
                nemzetközi fuvarjainknál mi végezzük Ön helyett.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
