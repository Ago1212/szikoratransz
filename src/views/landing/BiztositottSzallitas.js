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
        {
          q: "Mennyi idő alatt kapok ajánlatot?",
          a: "Általában 24 órán belül felvesszük Önnel a kapcsolatot egy részletes árajánlattal, amiben a biztosítási fedezet részletei is szerepelnek.",
        },
      )}
      testimonialNames={["Szabó Katalin", "Tóth Andrea", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Hogyan zajlik a kárrendezés lépésről lépésre?
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          <p>
            Kár esetén a folyamat egyszerű és gyors: jelezze felénk telefonon
            vagy e-mailben, lehetőleg fotókkal dokumentálva az észlelt
            sérülést vagy hiányt. Csapatunk ezután felveszi a kapcsolatot a
            biztosítóval, és összeállítja a kárrendezéshez szükséges
            dokumentációt — a fuvarlevelet, a felrakodáskori és
            kiszállításkori állapotot rögzítő adatokat, valamint az Ön által
            küldött dokumentációt.
          </p>
          <p>
            Önnek ezt követően nem kell közvetlenül egyeztetnie a
            biztosítóval — az ügyintézést végig csapatunk viszi, Ön csak a
            végeredményről kap visszajelzést. Ez a fedezet minden fuvarunkra
            automatikusan érvényes, külön kérés vagy felár nélkül,
            függetlenül attól, hogy belföldi vagy nemzetközi szállításról
            van szó.
          </p>
          <p className="text-sm text-[#23262B]/60">
            A fuvarozói felelősségbiztosításról és a kárrendezés általános
            menetéről a{" "}
            <a
              href="https://mabisz.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6D28D9] underline hover:text-[#5B21B6] transition-colors duration-300"
            >
              Magyar Biztosítók Szövetsége (MABISZ)
            </a>{" "}
            oldalán tájékozódhat bővebben — a konkrét kárügyintézést
            fuvarjainknál mi végezzük Ön helyett.
          </p>
        </div>
      </section>
    </ServicePage>
  );
}
