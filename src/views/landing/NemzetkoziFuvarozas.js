import React from "react";
import { PiGlobeLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function NemzetkoziFuvarozas() {
  return (
    <ServicePage
      icon={PiGlobeLight}
      accent="#0F766E"
      path="/nemzetkozi-fuvarozas-vamugyintezessel"
      metaTitle="Nemzetközi fuvarozás vámügyintézéssel | Szikora Transz Kft."
      metaDescription="Nemzetközi fuvarozás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Kérjen egyedi árajánlatot még ma — válasz 24 órán belül."
      eyebrow="Nemzetközi szállítás"
      h1="Nemzetközi fuvarozás, teljes körű vámügyintézéssel"
      intro="Határon átnyúló fuvarozási szolgáltatás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Az útvonalat és a határidőt minden esetben az adott fuvarhoz igazítjuk — Önnek nem kell a vámügyintézéssel foglalkoznia."
      bullets={[
        {
          title: "Teljes körű vámügyintézés",
          desc: "A szükséges vámügyintézést és okmányolást teljes egészében átvállaljuk Öntől.",
        },
        {
          title: "Európa-szerte",
          desc: "Nemzetközi fuvarozást vállalunk az egész kontinensen, egyedi útvonal-tervezéssel.",
        },
        {
          title: "Biztosított szállítás",
          desc: "Minden nemzetközi fuvarunk teljes biztosítási fedezettel zajlik, kár esetén a biztosítóval mi egyeztetünk.",
        },
        {
          title: "Egyedi árajánlat",
          desc: "Az útvonal, az áru jellege és a határidő alapján minden nemzetközi megbízást egyedileg árazunk.",
        },
      ]}
      faqItems={pickFaq(
        "Vállalnak nemzetközi szállítást?",
        {
          q: "Biztosított a szállított áru?",
          a: "Igen, nemzetközi fuvarjaink is teljes körű biztosítási fedezettel zajlanak a felvételtől a célországbeli kiszállításig — a határátlépés nem jelent kiesést a fedezetben.",
        },
        {
          q: "Mi történik, ha kár keletkezik szállítás közben?",
          a: "Nemzetközi fuvarnál is haladéktalanul jelezze felénk telefonon vagy e-mailben — csapatunk a biztosítóval egyeztetve intézi a kárrendezést, függetlenül attól, hogy a kár melyik országban érte az árut.",
        },
        {
          q: "Milyen fizetési feltételeket fogadnak el?",
          a: "Nemzetközi partnereinknél a fizetési határidőt és — igény esetén — a pénznemet (forint vagy euró) is az adott megrendelés alapján egyeztetjük.",
        },
      )}
      testimonialNames={["Tóth Andrea", "Nagy Péter", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Amit érdemes tudni a nemzetközi fuvarok vámkezeléséről
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
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
        </div>
      </section>
    </ServicePage>
  );
}
