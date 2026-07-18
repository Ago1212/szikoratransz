import React from "react";
import { Link } from "react-router-dom";
import Footer from "components/Footers/Footer.js";
import Breadcrumb from "components/Landing/Breadcrumb.js";
import { useSeo } from "utils/useSeo.js";

const BREADCRUMB_ITEMS = [{ name: "Adatvédelmi tájékoztató", path: "/adatvedelem" }];

// Adatvédelmi tájékoztató — elsősorban az ajánlatkérő/sofőr-jelentkezési
// formok GDPR-hozzájárulási jelölőnégyzete hivatkozik erre az oldalra
// (ld. components/Landing/QuoteForm.js). A szöveg a jelenleg ténylegesen
// kezelt adatkörre épül (name/email/phone/message a sendAjanlatkeres és
// sendJelentkezes backend actionökből, ld. backend/ApiHandler.php
// saveAjanlatkeres() és backend/interface/emailInterface.php) — nem
// tartalmaz olyan adatkezelést, ami a kódban ne létezne.
export default function Adatvedelem() {
  useSeo({
    title: "Adatvédelmi tájékoztató | Szikora Transz Kft.",
    description:
      "Tájékoztató, milyen személyes adatokat kezel a Szikora Transz Kft. az ajánlatkérő és sofőr-jelentkezési űrlapok kitöltésekor, és milyen jogok illetik meg Önt.",
    path: "/adatvedelem",
    breadcrumb: BREADCRUMB_ITEMS,
  });

  return (
    <div className="font-sans min-h-screen bg-[#F2F3F5]">
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/logo2.svg" alt="Szikora Transz Kft" width="1600" height="578" className="h-9 w-auto" />
          </Link>
          <Link
            to="/"
            className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
          >
            ← Vissza a főoldalra
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <Breadcrumb items={BREADCRUMB_ITEMS} />
        <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8] mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E3AA8]"></span>
          Jogi tájékoztató
        </span>
        <h1 className="font-[Overpass] font-extrabold text-4xl text-[#23262B] tracking-tight mb-6">
          Adatvédelmi tájékoztató
        </h1>

        <div className="prose prose-p:text-[#23262B]/75 prose-headings:text-[#23262B] max-w-none space-y-8 text-[#23262B]/75 leading-relaxed">
          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              1. Az adatkezelő
            </h2>
            <p>
              Szikora Transz Kft. (2518 Leányvár, Bécsi út 86, adószám:
              26381626-2-11, e-mail:{" "}
              <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                szikoratransz@gmail.com
              </a>
              ) az alábbiak szerint kezeli a weboldalon (szikora-transz.hu)
              található ajánlatkérő és sofőr-jelentkezési űrlapok
              kitöltésekor megadott személyes adatokat.
            </p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              2. Milyen adatokat kezelünk
            </h2>
            <p>Az űrlapok kitöltésekor az alábbi adatokat adja meg:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>teljes név</li>
              <li>telefonszám</li>
              <li>email cím</li>
              <li>
                a fuvarral/jelentkezéssel kapcsolatos, Ön által megadott
                további adatok (pl. a fuvar iránya, honnan/hová szállítanánk,
                kívánt időzítés, a szállítandó áru leírása, illetve
                sofőr-jelentkezés esetén a végzettségre/tapasztalatra
                vonatkozó információk)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              3. Az adatkezelés célja és jogalapja
            </h2>
            <p>
              Az adatkezelés célja az Ön ajánlatkérésének vagy sofőr-
              jelentkezésének megválaszolása, és a kapcsolatfelvétel az Ön
              által megadott elérhetőségeken. Az adatkezelés jogalapja az Ön
              önkéntes hozzájárulása, amelyet az űrlap elküldésével ad meg.
            </p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              4. Az adatkezelés időtartama
            </h2>
            <p>
              Az űrlapon megadott adatokat a megkeresés megválaszolásához, és
              — amennyiben ebből üzleti kapcsolat jön létre — az együttműködés
              időtartama alatt kezeljük. Amennyiben a megkeresésből nem lesz
              üzleti kapcsolat, az adatokat legkésőbb a megkeresés
              lezárását követő ésszerű időn belül töröljük.
            </p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              5. Ki fér hozzá az adatokhoz
            </h2>
            <p>
              A megadott adatokhoz a Szikora Transz Kft. az ajánlatadásért/
              toborzásért felelős munkatársai férnek hozzá. Adatait
              harmadik félnek nem adjuk át, kivéve, ha ezt jogszabály írja
              elő.
            </p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              6. Az Ön jogai
            </h2>
            <p>Adatai vonatkozásában Önt megilleti:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>a hozzáférés joga (tájékoztatást kérhet arról, milyen adatait kezeljük),</li>
              <li>a helyesbítés joga,</li>
              <li>a törlés joga,</li>
              <li>az adatkezelés korlátozásának joga,</li>
              <li>a hozzájárulás bármikori visszavonásának joga,</li>
              <li>és a felügyeleti hatósághoz (NAIH) fordulás joga.</li>
            </ul>
            <p>
              Ezen jogaival kapcsolatban forduljon hozzánk a{" "}
              <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                szikoratransz@gmail.com
              </a>{" "}
              címen.
            </p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              7. Jogorvoslat
            </h2>
            <p>
              Amennyiben úgy ítéli meg, hogy adatai kezelése nem felel meg a
              jogszabályi előírásoknak, panasszal fordulhat a Nemzeti
              Adatvédelmi és Információszabadság Hatósághoz (NAIH), vagy
              bírósághoz fordulhat.
            </p>
          </section>

          <p className="text-xs text-[#23262B]/40 pt-6 border-t border-[#23262B]/10">
            * Ez a tájékoztató a weboldalon jelenleg ténylegesen működő
            űrlapok (ajánlatkérés, sofőr-jelentkezés) adatkezelését mutatja
            be. Érdemes jogi szakértővel felülvizsgáltatni, mielőtt teljes
            körűen, minden jövőbeli adatkezelésre nézve is
            véglegesnek tekintenék.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
