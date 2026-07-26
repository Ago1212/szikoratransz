import React from "react";
import { PiFileTextLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function EgyediArajanlat() {
  return (
    <ServicePage
      icon={PiFileTextLight}
      accent="#059669"
      path="/egyedi-arajanlat-fuvarozas"
      metaTitle="Egyedi árajánlat fuvarozásra | Szikora Transz Kft."
      metaDescription="Nincs két egyforma fuvar — minden szállítást egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Kérjen ingyenes árajánlatot még ma."
      eyebrow="Egyedi árajánlat"
      h1="Egyedi árajánlat — bármilyen árut szállítunk"
      intro="Nem szakosodtunk egyetlen iparágra sem: bármilyen árut szállítunk, az Ön igényei szerint. Mivel nincs két egyforma fuvar, nincs fix díjszabásunk sem — minden megrendelést egyedileg, tételesen árazunk."
      bullets={[
        {
          title: "Bármilyen áru, bármilyen igény",
          desc: "Nem korlátozzuk magunkat egy-egy iparágra vagy árutípusra — mondja el, mit kell szállítani, mi megoldjuk.",
        },
        {
          title: "Átlátható, tételes árazás",
          desc: "A távolság, az áru mérete/súlya/jellege és a határidő alapján adunk pontos, nem sablonos árajánlatot.",
        },
        {
          title: "Nincs rejtett költség",
          desc: "Az ajánlatban minden tétel átlátható — amit ajánlunk, azt számlázzuk.",
        },
        {
          title: "Kötöttség nélküli ajánlatkérés",
          desc: "Az árajánlat ingyenes és nem kötelezi Önt a megrendelésre.",
        },
      ]}
      faqItems={pickFaq(
        {
          q: "Mitől függ egy fuvar ára?",
          a: "Mivel nincs két egyforma megrendelésünk, nincs egységes díjtáblázatunk sem — minden ajánlatot a konkrét útvonal, az áru mérete, súlya és jellege, valamint a vállalt határidő alapján, egyedileg számolunk ki. Mondja el a részleteket, és pontos, tételes árajánlatot küldünk.",
        },
        "Kérhetek egyedi árajánlatot speciális igényekhez?",
        {
          q: "Milyen fizetési feltételeket fogadnak el?",
          a: "Mivel minden megrendelést egyedileg árazunk, a fizetési határidőt és módot (átutalás vagy számlás fizetés) is a konkrét fuvarhoz igazítva állapítjuk meg.",
        },
      )}
      testimonialNames={["Kovács Gábor", "Molnár Eszter", "Szabó Katalin"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Milyen szállítmányokat vállalunk egyedi árajánlattal?
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          <p>
            A gyakorlatban ez leggyakrabban azt jelenti, hogy vállalunk
            túlméretes vagy túlsúlyos rakományt, állóhelyzetben szállítandó
            gépet vagy berendezést, több fordulóban szállítandó, nagy
            mennyiségű tételt, valamint olyan árut, ami rakodás közben
            különleges figyelmet igényel (törékeny, nem raklapozható, vagy
            egyedi rögzítést igénylő). Ha bármelyik ismerősen hangzik az Ön
            szállítmányára, jó helyen jár.
          </p>
          <p>
            Ha bizonytalan, hogy egy adott rakomány beleillik-e a szokásos
            szolgáltatásainkba, néhány kérdés segít eldönteni: elfér-e egy
            szabványos kamionplatón vagy speciális felépítmény kell hozzá,
            igényel-e emelőhátfalat vagy darus rakodást a fel-/lerakodáshoz,
            és van-e olyan útvonal-korlátozás (pl. súlykorlátozott híd,
            keskeny bejárat), amit előre figyelembe kell vennünk. Ezekre a
            válaszokra épül az ajánlatkérésnél összeállított pontos árajánlat.
          </p>
        </div>
      </section>
    </ServicePage>
  );
}
