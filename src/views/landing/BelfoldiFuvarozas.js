import React from "react";
import { Link } from "react-router-dom";
import { PiTruckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";

export default function BelfoldiFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiTruckLight}
      accent="#1E3AA8"
      path="/belfoldi-fuvarozas-arajanlat"
      metaTitle={t("pages.belfoldi.metaTitle")}
      metaDescription={t("pages.belfoldi.metaDescription")}
      eyebrow={t("pages.belfoldi.eyebrow")}
      h1={t("pages.belfoldi.h1")}
      intro={t("pages.belfoldi.intro")}
      bullets={t("pages.belfoldi.bullets")}
      faqItems={pickFaq(t, "response_time", "pricing_factors", "vehicles", "payment_terms")}
      testimonialNames={["Nagy Péter", "Szabó Katalin", "Farkas Zoltán"]}
      areaServed={["HU"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.belfoldi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Two things help us give you the fastest, most accurate quote: the exact pickup and delivery
                addresses (is loading equipment available on site, or does it need to be done by hand), and
                whether it's a partial load or a full truckload — the latter directly determines the size and
                type of vehicle we assign to the job.
              </p>
              <p>
                Vehicle selection follows the same logic: smaller, faster jobs get a lighter truck, heavier
                loads get a bigger one. If it's a regular, recurring route (e.g. the same destination several
                times a week), let us know when requesting your quote — for our regular partners, we agree on
                scheduling and pricing over the longer term, rather than renegotiating for every single job.
              </p>
              <p>
                Once you accept a quote, most domestic jobs are scheduled for the very next business day. Need
                something even more urgent — same-day, or within just a few hours? Check the terms of our{" "}
                <Link
                  to={localizePath("/expressz-fuvarozas", locale)}
                  className="text-[#1E3AA8] underline hover:text-[#172E86] transition-colors duration-300"
                >
                  express freight transport
                </Link>{" "}
                — that's where we give short-notice jobs priority handling.
              </p>
            </>
          ) : (
            <>
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
                  to={localizePath("/expressz-fuvarozas", locale)}
                  className="text-[#1E3AA8] underline hover:text-[#172E86] transition-colors duration-300"
                >
                  expressz fuvarozás
                </Link>{" "}
                feltételeit — ott soron kívül kezeljük a rövid határidejű
                megbízásokat.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
