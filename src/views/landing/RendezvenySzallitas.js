import React from "react";
import { PiConfettiLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function RendezvenySzallitas() {
  const { t } = useTranslation();
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
        t,
        { id: "response_time", aKey: "pages.rendezveny.faqOverrides.response_time.a" },
        { id: "custom_quote", aKey: "pages.rendezveny.faqOverrides.custom_quote.a" },
        { id: "vehicles", aKey: "pages.rendezveny.faqOverrides.vehicles.a" },
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
