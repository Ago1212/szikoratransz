import React from "react";
import { PiShieldCheckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function BiztositottSzallitas() {
  const { t, locale } = useTranslation();
  const steps = t("pages.biztositott.section.steps");
  return (
    <ServicePage
      icon={PiShieldCheckLight}
      accent="#6D28D9"
      path="/biztositott-szallitas"
      metaTitle={t("pages.biztositott.metaTitle")}
      metaDescription={t("pages.biztositott.metaDescription")}
      eyebrow={t("pages.biztositott.eyebrow")}
      h1={t("pages.biztositott.h1")}
      intro={t("pages.biztositott.intro")}
      bullets={t("pages.biztositott.bullets")}
      faqItems={pickFaq(
        t,
        "insurance",
        "damage",
        { id: "response_time", aKey: "pages.biztositott.faqOverrides.response_time.a" },
      )}
      testimonialNames={["Szabó Katalin", "Tóth Andrea", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.biztositott.section.heading")}
        </h2>
        <ol className="space-y-4 mb-5">
          {steps.map((item, i) => (
            <li key={item.step} className="flex items-start gap-4">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-[Overpass_Mono] font-bold"
                style={{ backgroundColor: "#6D28D91A", color: "#6D28D9" }}
              >
                {i + 1}
              </span>
              <div>
                <p className="font-[Overpass] font-semibold text-[#23262B]">{item.step}</p>
                <p className="text-[#23262B]/70 text-sm mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                This coverage automatically applies to every job we handle, at no extra request or cost,
                regardless of whether it's a domestic or international shipment.
              </p>
              <p className="text-sm text-[#23262B]/60">
                You can find more information on carrier liability insurance and the general claims process on
                the website of the{" "}
                <a
                  href="https://mabisz.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6D28D9] underline hover:text-[#5B21B6] transition-colors duration-300"
                >
                  Association of Hungarian Insurance Companies (MABISZ)
                </a>{" "}
                — for your shipments, we handle the actual claims process on your behalf.
              </p>
            </>
          ) : (
            <>
              <p>
                Ez a fedezet minden fuvarunkra automatikusan érvényes, külön
                kérés vagy felár nélkül, függetlenül attól, hogy belföldi vagy
                nemzetközi szállításról van szó.
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
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
