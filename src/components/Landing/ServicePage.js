import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PiArrowRightLight, PiCheckLight, PiQuotesLight } from "react-icons/pi";
import Footer from "components/Footers/Footer.js";
import QuoteForm from "components/Landing/QuoteForm.js";
import Breadcrumb from "components/Landing/Breadcrumb.js";
import { TESTIMONIALS, SERVICE_PAGES } from "data/landingContent.js";
import { useSeo } from "utils/useSeo.js";
import { useTranslation, localizePath } from "i18n/index.js";

// Közös sablon a szolgáltatás-specifikus long-tail SEO oldalakhoz (belföldi/
// nemzetközi/expressz/rendezvény/egyedi árajánlat — ld. src/views/landing/).
// A Landing.js főoldal saját, teljes (nav+hero+minden szekció) felépítését
// szándékosan nem osztja meg ezekkel az oldalakkal: itt nincsenek `#services`
// jellegű horgony-szekciók, amikre a főoldal navigációja épül, ezért egy
// egyszerűbb, csak "vissza a főoldalra" fejléccel dolgozó elrendezés illik.
export default function ServicePage({
  icon: Icon,
  accent = "#1E3AA8",
  eyebrow,
  h1,
  intro,
  bullets = [],
  faqItems = [],
  metaTitle,
  metaDescription,
  path,
  testimonialNames,
  areaServed,
  children,
}) {
  const { t, locale } = useTranslation();
  const currentService = SERVICE_PAGES.find((s) => s.path === path);
  const currentServiceLabel = currentService ? t(`landing.servicePages.${currentService.id}`) : null;
  const localizedPath = localizePath(path, locale);
  const breadcrumbItems = currentService
    ? [{ name: currentServiceLabel, path: localizedPath }]
    : [];
  // `path` a kanonikus HU útvonal (ld. a fájl tetején lévő komment) —
  // `localizePath` adja mindkét nyelvi változatot, hogy ne kelljen kézzel
  // felírt "/en${path}" stringet karbantartani. `useMemo`-val stabil a
  // referencia rendereléskor át (pl. a QuoteForm gépelése közben), hogy a
  // useSeo effektje ne bontsa le/építse újra feleslegesen a hreflang
  // tageket minden billentyűleütésnél.
  const alternates = useMemo(
    () => ({ hu: localizePath(path, "hu"), en: localizePath(path, "en") }),
    [path],
  );
  useSeo({
    title: metaTitle,
    description: metaDescription,
    path: localizedPath,
    lang: locale,
    alternates,
    faqItems,
    breadcrumb: breadcrumbItems.length > 0 ? breadcrumbItems : undefined,
    service: currentService
      ? { name: currentServiceLabel, description: metaDescription, areaServed }
      : undefined,
  });

  const otherServices = SERVICE_PAGES.filter((s) => s.path !== path);

  // Melyik 3 referenciát mutassuk ehhez az oldalhoz — SEO-audit szerint
  // korábban mind a 6 long-tail oldal + a főoldal ugyanazt a 3 referenciát,
  // ugyanabban a sorrendben jelenítette meg (near-duplicate content). A
  // `testimonialNames` prop oldalanként más 3-as kombinációt választ ki a
  // TESTIMONIALS közös pooljából; ha egy oldal nem ad meg saját listát, a
  // pool első 3 eleme a visszaeső alapértelmezés.
  const shownTestimonials = (
    testimonialNames && testimonialNames.length > 0
      ? testimonialNames.map((n) => TESTIMONIALS.find((item) => item.name === n)).filter(Boolean)
      : TESTIMONIALS.slice(0, 3)
  ).map((item) => ({
    name: item.name,
    quote: t(`landing.testimonialItems.${item.id}.quote`),
    role: t(`landing.testimonialItems.${item.id}.role`),
    company: t(`landing.testimonialItems.${item.id}.company`),
  }));

  // Minimális belépő animáció a hero-nak — nem a görgetési pozíciót
  // animáljuk (ld. ScrollToTop.js: az korábban épp azért volt zavaró, mert
  // az új oldal alsóbb szakaszait villantotta fel útközben), hanem a már a
  // tetején, a helyén álló tartalmat úsztatjuk be egy finom fade+enyhe
  // felfelé mozgással, ugyanazt a mintát követve, mint a Landing.js `Reveal`
  // komponense (`prefers-reduced-motion` figyelembevételével).
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntered(true);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="font-sans min-h-screen bg-[#F2F3F5]">
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to={localizePath("/", locale)}>
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              width="1600"
              height="578"
              className="h-9 w-auto"
              fetchpriority="high"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={localizePath("/", locale)}
              className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
            >
              {t("servicePage.backLink")}
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide">
              <Link
                to={localizePath(path, "hu")}
                className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
              >
                HU
              </Link>
              <span className="text-[#23262B]/30">|</span>
              <Link
                to={localizePath(path, "en")}
                className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
              >
                EN
              </Link>
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {breadcrumbItems.length > 0 && (
          <Breadcrumb
            items={breadcrumbItems}
            homeLabel={t("landing.breadcrumbHome")}
            homePath={localizePath("/", locale)}
            navLabel={t("landing.breadcrumbNavLabel")}
          />
        )}

        {/* HERO — a `Icon`/`accent` adja a szolgáltatásra jellemző vizuális
            identitást: halványított, nagyméretű háttér-ikon + színezett
            jelvény, hogy az oldal ne csak szövegében, de látványban is
            elüsse a többi long-tail oldalt. */}
        <section
          className={`relative overflow-hidden pt-14 pb-10 md:pt-20 md:pb-14 transition-all duration-300 ease-out ${
            entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {Icon && (
            <Icon
              aria-hidden="true"
              className="pointer-events-none select-none absolute -right-8 -top-14 text-[160px] md:-right-10 md:-top-20 md:text-[260px]"
              style={{ color: accent, opacity: 0.07 }}
            />
          )}
          <div className="relative flex items-center gap-3 mb-5">
            {Icon && (
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: `${accent}1A`, color: accent }}
              >
                <Icon />
              </span>
            )}
            <span
              className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }}></span>
              {eyebrow}
            </span>
          </div>
          <h1 className="relative font-[Overpass] font-extrabold text-4xl md:text-5xl leading-[1.08] text-[#23262B] tracking-tight text-balance">
            {h1}
          </h1>
          <p className="relative text-lg text-[#23262B]/70 max-w-2xl mt-5 text-balance">{intro}</p>
          <a
            href="#ajanlatkeres"
            className="relative mt-7 inline-flex items-center gap-2 px-6 py-3 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-colors duration-300"
          >
            {t("servicePage.ctaButton")}
            <PiArrowRightLight />
          </a>
        </section>

        {/* MIÉRT MINKET */}
        {bullets.length > 0 && (
          <section className="py-10 border-t border-[#23262B]/10">
            <div className="grid sm:grid-cols-2 gap-6">
              {bullets.map((b) => (
                <div key={b.title} className="flex items-start gap-4">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <PiCheckLight />
                  </span>
                  <div>
                    <h3 className="font-[Overpass] font-bold text-[#23262B]">{b.title}</h3>
                    <p className="text-[#23262B]/70 text-sm mt-1">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {children}

        {/* REFERENCIÁK */}
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
            {t("servicePage.testimonialsTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {shownTestimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-white border border-[#23262B]/10 rounded-xl p-6 flex flex-col h-full"
              >
                <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-3" />
                <p className="text-[#23262B]/75 text-sm leading-relaxed mb-5 flex-grow">{testimonial.quote}</p>
                <div className="text-sm pt-3 border-t border-[#23262B]/10">
                  <div className="font-[Overpass] font-semibold text-[#23262B]">{testimonial.name}</div>
                  <div className="text-[#23262B]/50 text-xs">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#23262B]/35 mt-6 max-w-2xl">{t("servicePage.testimonialsDisclaimer")}</p>
        </section>

        {/* GYIK */}
        {faqItems.length > 0 && (
          <section className="py-10 border-t border-[#23262B]/10">
            <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
              {t("servicePage.faqTitle")}
            </h2>
            <div className="divide-y divide-[#23262B]/10 border-t border-b border-[#23262B]/10">
              {faqItems.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <h3 className="font-[Overpass] font-semibold text-[#23262B] m-0">{item.q}</h3>
                    <span className="text-[#1E3AA8] text-sm flex-shrink-0 transition-transform duration-300 group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="text-[#23262B]/70 leading-relaxed pt-3 pr-8">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* AJÁNLATKÉRÉS */}
        <section id="ajanlatkeres" className="py-10 border-t border-[#23262B]/10">
          <QuoteForm />
        </section>

        {/* EGYÉB SZOLGÁLTATÁSOK */}
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass_Mono] text-xs uppercase tracking-[0.2em] text-[#23262B]/50 mb-4">
            {t("servicePage.otherServicesTitle")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {otherServices.map((s) => (
              <Link
                key={s.path}
                to={localizePath(s.path, locale)}
                className="px-4 py-2 rounded-full border border-[#23262B]/15 text-sm font-[Overpass] font-medium text-[#23262B]/70 hover:border-[#1E3AA8]/50 hover:text-[#1E3AA8] transition-colors duration-300"
              >
                {t(`landing.servicePages.${s.id}`)}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
