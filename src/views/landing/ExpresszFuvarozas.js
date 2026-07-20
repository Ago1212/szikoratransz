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
        "Mitől függ egy fuvar ára?",
        "Kérhetek egyedi árajánlatot speciális igényekhez?",
      )}
      testimonialNames={["Farkas Zoltán", "Kovács Gábor", "Nagy Péter"]}
    />
  );
}
