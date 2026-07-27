import React from "react";
import { Link } from "react-router-dom";
import { PiTruckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function BelfoldiFuvarozas() {
  const { t } = useTranslation();
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
      faqItems={pickFaq(t, "response_time", "pricing_factors", "vehicles", "payment_terms")}
      testimonialNames={["Nagy Péter", "Szabó Katalin", "Farkas Zoltán"]}
      areaServed={["HU"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          Hogyan alakul ki a belföldi fuvar ára?
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          <p>
            Az ajánlatkérésnél két dolog segít a leggyorsabb, legpontosabb
            árazásban: a pontos fel- és lerakodási cím (van-e rakodógép a
            helyszínen, vagy kézi erővel kell megoldani), és hogy
            részrakományról vagy teljes kamionrakományról van-e szó — ez
            utóbbi közvetlenül meghatározza, milyen méretű és típusú
            járművet rendelünk a fuvarhoz.
          </p>
          <p>
            A jármű kiválasztása is ehhez igazodik: kisebb, gyors fuvaroknál
            könnyebb, nagyobb terhelésnél nehezebb kamiont állítunk munkába.
            Ha rendszeres, ismétlődő útvonalról van szó (pl. heti több
            alkalommal ugyanarra a célállomásra), ezt jelezze az
            ajánlatkérésnél — állandó partnereinknél az ütemezést és az
            árazást is hosszabb távra egyeztetjük, nem fuvaronként
            újratárgyalva.
          </p>
          <p>
            Miután elfogadta az árajánlatot, a legtöbb belföldi fuvart már a
            következő munkanapon ütemezzük. Ennél sürgősebb, akár aznapi
            vagy pár órás határidőre van szüksége? Nézze meg az{" "}
            <Link
              to="/expressz-fuvarozas"
              className="text-[#1E3AA8] underline hover:text-[#172E86] transition-colors duration-300"
            >
              expressz fuvarozás
            </Link>{" "}
            feltételeit — ott soron kívül kezeljük a rövid határidejű
            megbízásokat.
          </p>
        </div>
      </section>
    </ServicePage>
  );
}
