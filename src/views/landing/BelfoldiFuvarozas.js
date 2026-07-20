import React from "react";
import { PiTruckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function BelfoldiFuvarozas() {
  return (
    <ServicePage
      icon={PiTruckLight}
      accent="#1E3AA8"
      path="/belfoldi-fuvarozas-arajanlat"
      metaTitle="Belföldi fuvarozás árajánlat | Szikora Transz Kft."
      metaDescription="Kérjen ingyenes árajánlatot belföldi fuvarozásra Magyarország egész területén — modern flotta, biztosított szállítás, válasz 24 órán belül."
      eyebrow="Belföldi fuvarozás"
      h1="Belföldi fuvarozás árajánlat — 24 órán belül"
      intro="Gyors és megbízható áruszállítás Magyarország egész területén, rugalmas árazással és pontos határidőkkel. Egyaránt vállalunk egyszeri megbízásokat és rendszeres, ismétlődő fuvarokat — az áru jellegétől függetlenül."
      bullets={[
        {
          title: "Rugalmas, egyedi árazás",
          desc: "Nincs egységes díjszabás — minden fuvart a távolság, az áru jellege és a határidő alapján, tételesen árazunk.",
        },
        {
          title: "Modern, karbantartott flotta",
          desc: "A szállítandó áru jellegéhez igazított jármű kiválasztása az ajánlatkérés során történik.",
        },
        {
          title: "Egyszeri és rendszeres fuvarok",
          desc: "Ugyanúgy vállalunk alkalmi megbízást, mint hosszú távú, ismétlődő partnerséget.",
        },
        {
          title: "Teljes körű biztosítás",
          desc: "Minden belföldi fuvarunk a felvételtől a kiszállításig biztosítási fedezet mellett zajlik.",
        },
      ]}
      faqItems={pickFaq(
        "Mennyi idő alatt kapok ajánlatot?",
        "Mitől függ egy fuvar ára?",
        "Milyen járművekkel dolgoznak?",
        "Milyen fizetési feltételeket fogadnak el?",
      )}
      testimonialNames={["Nagy Péter", "Szabó Katalin", "Farkas Zoltán"]}
    />
  );
}
