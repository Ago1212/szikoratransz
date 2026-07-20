import React from "react";
import { PiLightningLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function ExpresszFuvarozas() {
  return (
    <ServicePage
      icon={PiLightningLight}
      accent="#D97706"
      path="/expressz-fuvarozas"
      metaTitle="Expressz fuvarozás — sürgős szállítás | Szikora Transz Kft."
      metaDescription="Sürgős fuvar? Expressz szállítás garantált kiszállítási idővel, soron kívüli kezeléssel. Kérjen ajánlatot most — válasz 24 órán belül."
      eyebrow="Expressz szállítás"
      h1="Expressz fuvarozás, ha az idő a legfontosabb"
      intro="Sürgős fuvarok soron kívüli kezelése, garantált kiszállítási idővel — akkor is, ha a szállítást csak órákkal előre tudja bejelenteni. Vegye fel velünk a kapcsolatot, és soron kívül egyeztetjük a részleteket."
      bullets={[
        {
          title: "Soron kívüli kezelés",
          desc: "Sürgős megbízásokat kiemelten, a normál ütemezésen kívül kezelünk.",
        },
        {
          title: "Garantált kiszállítási idő",
          desc: "Az ajánlatkérés során egyeztetett határidőt vállaljuk — pontosan, percre.",
        },
        {
          title: "Gyors kapcsolatfelvétel",
          desc: "Sürgős esetben hívjon közvetlenül telefonon a gyorsabb egyeztetésért.",
        },
        {
          title: "Ugyanaz a biztonság, sürgősen is",
          desc: "Az expressz fuvarok is teljes biztosítási fedezettel zajlanak.",
        },
      ]}
      faqItems={pickFaq(
        {
          q: "Mennyi idő alatt kapok ajánlatot?",
          a: "Expressz megbízásoknál ennél is gyorsabban, jellemzően néhány órán belül visszajelzünk — sürgős esetben hívjon minket közvetlenül telefonon a leggyorsabb egyeztetésért.",
        },
        {
          q: "Mitől függ egy fuvar ára?",
          a: "Sürgős fuvaroknál a szokásos tényezők (távolság, az áru mérete és jellege) mellett a rendelkezésre álló időablak is számít — minél rövidebb a bejelentési idő, annál inkább az adott pillanatban szabad kapacitásunkhoz igazodik az ajánlat. Egyedi, tételes árazás itt is érvényes, nincs automatikus sürgősségi felár.",
        },
        {
          q: "Kérhetek egyedi árajánlatot speciális igényekhez?",
          a: "Igen — sürgős, szokatlan méretű vagy speciális kezelést igénylő rakományra is adunk egyedi árajánlatot, akár rövid határidővel is. Hívjon minket közvetlenül, ha a helyzet gyors egyeztetést igényel.",
        },
      )}
      testimonialNames={["Farkas Zoltán", "Kovács Gábor", "Nagy Péter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Mit jelent pontosan a garantált kiszállítási idő?
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
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
        </div>
      </section>
    </ServicePage>
  );
}
