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
        "Biztosított a szállított áru?",
        "Mi történik, ha kár keletkezik szállítás közben?",
        "Milyen fizetési feltételeket fogadnak el?",
      )}
    />
  );
}
