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
      metaTitle="Egyedi árajánlat fuvarozásra — bármilyen áru | Szikora Transz Kft."
      metaDescription="Nincs két egyforma fuvar — minden szállítást egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Kérjen ingyenes, kötöttség nélküli árajánlatot."
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
        "Mitől függ egy fuvar ára?",
        "Kérhetek egyedi árajánlatot speciális igényekhez?",
        "Milyen fizetési feltételeket fogadnak el?",
      )}
    />
  );
}
