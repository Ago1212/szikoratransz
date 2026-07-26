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
        {
          q: "Mennyi idő alatt kapok ajánlatot?",
          a: "Rendezvényszállításnál is jellemzően 24 órán belül jelentkezünk egy, az esemény időpontjához és a helyszín sajátosságaihoz igazított árajánlattal — ha az esemény időpontja már közel van, jelezze ezt is, és soron kívül foglalkozunk vele.",
        },
        {
          q: "Kérhetek egyedi árajánlatot speciális igényekhez?",
          a: "Igen — rendezvényenként egyedi árajánlatot adunk a szállítandó anyag mennyisége, a helyszín sajátosságai (pl. be- és kirakodási időablak) és az esemény pontos ütemezése alapján.",
        },
        {
          q: "Milyen járművekkel dolgoznak?",
          a: "A rendezvényanyagok (standelemek, berendezések, dekoráció) jellege és mérete alapján választjuk ki a megfelelő járművet — modern, karbantartott flottánkból mindig azt, amelyik a legbiztonságosabban és leghatékonyabban szállítja az adott anyagot a helyszínre.",
        },
      )}
      testimonialNames={["Molnár Eszter", "Farkas Zoltán", "Tóth Andrea"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Mire figyelünk rendezvényszállításnál?
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          <p>
            A rendezvényszállítás abban különbözik egy szokásos fuvartól,
            hogy szinte mindig két, egymástól élesen elváló időpontra kell
            pontosan érkezni: a kiszállításra (a felállítás/berendezés
            előtt) és az elszállításra (a bontás után). Mindkettőt a
            rendezvény, illetve a helyszín saját ütemezéséhez — pl. a be- és
            kirakodásra kijelölt időablakhoz — igazítjuk, nem fordítva.
          </p>
          <p>
            Standelemeket, kiállítási anyagokat, technikai berendezéseket és
            dekorációt egyaránt körültekintően, az adott anyag
            sérülékenységéhez igazított rögzítéssel szállítunk. Ha a
            helyszínnek egyedi behajtási vagy rakodási szabályai vannak (pl.
            korlátozott behajtási időszak, emelős rakodás szükségessége),
            ezt már az ajánlatkérésnél érdemes jeleznie, hogy előre tudjunk
            vele kalkulálni.
          </p>
          <p>
            Igény esetén közvetlenül egyeztetünk a helyszín
            kapcsolattartójával vagy a rendezvényszervezővel is, hogy a be-
            és kiszállítás időpontja garantáltan illeszkedjen a helyszín
            saját ütemezéséhez.
          </p>
        </div>
      </section>
    </ServicePage>
  );
}
