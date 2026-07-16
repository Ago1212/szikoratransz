import React from "react";
import { PiShieldCheckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function BiztositottSzallitas() {
  return (
    <ServicePage
      icon={PiShieldCheckLight}
      accent="#6D28D9"
      path="/biztositott-szallitas"
      metaTitle="Biztosított szállítás | Szikora Transz Kft."
      metaDescription="Minden fuvarunk teljes biztosítási fedezettel történik — az áru felvételtől a kiszállításig biztos kezekben van. Kérjen árajánlatot."
      eyebrow="Biztosított szállítás"
      h1="Biztosított szállítás — az árukészlete biztos kezekben van"
      intro="Minden fuvarunkat teljes körű biztosítási fedezet mellett végezzük, a felvételtől a kiszállításig. Esetleges kár esetén csapatunk intézi a biztosítóval a kárrendezés teljes ügymenetét, Önnek nem kell utánajárnia."
      bullets={[
        {
          title: "Teljes körű fedezet minden fuvarra",
          desc: "Külön kérés nélkül, alapból biztosítási fedezet mellett szállítunk — nincs rejtett kikötés vagy felár.",
        },
        {
          title: "Kárrendezés helyett Ön a dolgára figyelhet",
          desc: "Kár esetén a biztosítóval való egyeztetést és a kárrendezés ügyintézését csapatunk vállalja át Öntől.",
        },
        {
          title: "Gondos kezelés, a fedezettől függetlenül",
          desc: "A biztosítás mellett a rakodás és a szállítás során is körültekintően, sérülésmentesen kezeljük az árut.",
        },
        {
          title: "Bármilyen áruféleséghez igazítva",
          desc: "Az áru jellege és értéke alapján a legmegfelelőbb járművet és fedezetet választjuk a fuvarhoz.",
        },
      ]}
      faqItems={pickFaq(
        "Biztosított a szállított áru?",
        "Mi történik, ha kár keletkezik szállítás közben?",
        "Mennyi idő alatt kapok ajánlatot?",
      )}
    />
  );
}
