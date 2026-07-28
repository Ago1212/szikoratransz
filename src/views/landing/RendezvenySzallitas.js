import React from "react";
import { PiConfettiLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function RendezvenySzallitas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiConfettiLight}
      accent="#BE185D"
      path="/rendezveny-szallitas"
      metaTitle={t("pages.rendezveny.metaTitle")}
      metaDescription={t("pages.rendezveny.metaDescription")}
      eyebrow={t("pages.rendezveny.eyebrow")}
      h1={t("pages.rendezveny.h1")}
      intro={t("pages.rendezveny.intro")}
      bullets={t("pages.rendezveny.bullets")}
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
          {t("pages.rendezveny.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Event logistics differs from a typical job in that there are almost always two sharply distinct
                deadlines to hit precisely: delivery (before setup) and pickup (after teardown). We coordinate
                both around the event's — or venue's — own schedule, such as a designated loading/unloading
                window, rather than the other way around.
              </p>
              <p>
                We handle booth elements, exhibition materials, technical equipment, and decor carefully,
                securing each item according to how fragile it is. If the venue has specific access or loading
                rules (e.g. a restricted access window, or a requirement for lift-gate loading), it's worth
                flagging this when you request your quote, so we can plan for it in advance.
              </p>
              <p>
                If needed, we'll also coordinate directly with the venue's contact person or the event
                organizer, to make sure delivery and pickup times reliably line up with the venue's own
                schedule.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
