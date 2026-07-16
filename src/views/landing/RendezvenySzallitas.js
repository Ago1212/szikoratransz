import React from "react";
import { PiConfettiLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function RendezvenySzallitas() {
  return (
    <ServicePage
      icon={PiConfettiLight}
      accent="#BE185D"
      path="/rendezveny-szallitas"
      metaTitle="Rendezvényszállítás | Szikora Transz Kft."
      metaDescription="Rendezvényekhez kapcsolódó szállítás — standok, berendezések, dekoráció pontos, egyeztetett időpontra történő kiszállítása. Kérjen árajánlatot."
      eyebrow="Rendezvényszállítás"
      h1="Rendezvényszállítás — pontosan, az Ön ütemezése szerint"
      intro="Rendezvényekhez kapcsolódó szállítást is vállalunk — standok, berendezések, dekoráció és egyéb rendezvényanyagok szállítását a helyszínre és vissza, a rendezvény pontos időbeosztásához igazítva."
      bullets={[
        {
          title: "Az esemény ütemezéséhez igazodva",
          desc: "A kiszállítás és az elszállítás időpontját a rendezvény programjához egyeztetjük, nem fordítva.",
        },
        {
          title: "Gondos, óvatos kezelés",
          desc: "Berendezéseket, dekorációt és egyéb rendezvényanyagot is körültekintően, sérülésmentesen szállítunk.",
        },
        {
          title: "Rugalmas, akár rövid határidővel",
          desc: "Egyeztetés után soron kívüli, sürgős rendezvényszállítást is vállalunk.",
        },
        {
          title: "Egyedi árajánlat minden eseményre",
          desc: "A szállítandó anyag mennyisége, a helyszín és az időzítés alapján adunk pontos árajánlatot.",
        },
      ]}
      faqItems={pickFaq(
        "Mennyi idő alatt kapok ajánlatot?",
        "Kérhetek egyedi árajánlatot speciális igényekhez?",
        "Milyen járművekkel dolgoznak?",
      )}
    />
  );
}
