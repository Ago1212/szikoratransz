import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PiArrowRightLight,
  PiCheckLight,
  PiPhoneLight,
  PiQuotesLight,
  PiTruckLight,
  PiUserCircleLight,
} from "react-icons/pi";
import Footer from "components/Footers/Footer.js";
import QuoteForm from "components/Landing/QuoteForm.js";
import Breadcrumb from "components/Landing/Breadcrumb.js";
import LanguageSwitcher from "components/Landing/LanguageSwitcher.js";
import RouteDivider from "components/Landing/RouteDivider.js";
import { Reveal } from "components/Landing/Reveal.js";
import HungaryMapBackground from "components/UI/HungaryMapBackground.js";
import EuropeMapBackground from "components/UI/EuropeMapBackground.js";
import { TESTIMONIALS, SERVICE_PAGES } from "data/landingContent.js";
import { useSeo } from "utils/useSeo.js";
import { useTranslation, localizePath } from "i18n/index.js";

// Egy hex accent-szín world/sötétebb árnyalatát adja vissza (pl. a hero
// vizuális kártya gradiens-csíkjához vagy a kártya alján lévő feliratszínhez)
// — `percent` pozitív értéknél világosít, negatívnál sötétít. Csak erre a
// fájlra korlátozott, kis segédfüggvény, nem érdemel önálló util-modult.
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

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
      <style>{`
        @keyframes svcCtaShimmer {
          0% { background-position: 160% 0; }
          35%, 100% { background-position: -60% 0; }
        }
        .svcpage-cta-shimmer {
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: svcCtaShimmer 3.8s ease-in-out infinite;
          animation-delay: 1.2s;
        }
        @media (prefers-reduced-motion: reduce) {
          .svcpage-cta-shimmer { animation: none; }
        }
      `}</style>

      <nav className="sticky top-0 z-50 border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
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
            <LanguageSwitcher locale={locale} path={path} />
          </div>
        </div>
      </nav>

      {/* HERO — teljes szélességű szekció (a Landing.js főoldal hero-jével
          egyező mintát követve, ld. src/views/Landing.js), NEM a `max-w-5xl`
          `<main>`-en belül, hogy a háttértérkép-motívum (ugyanaz a
          HungaryMapBackground/EuropeMapBackground, amit a főoldal hero-ja
          is használ) a teljes viewport-szélességet kitölthesse. Két
          oszlopos elrendezés, mint a Landing.js hero-ja: bal oldalt a
          szöveg+CTA, jobb oldalt egy erős kontrasztú, sötét jelvény-kártya
          a szolgáltatás `Icon`/`accent`-jével — a korábbi verzióban ez az
          ikon egy 7%-os áttetszőségű, alig látható háttér-motívum volt
          (visszajelzés: "nem is jelennek meg a kamionok"), most a hero
          tényleges vizuális súlypontja, a Landing.js sötét ajánlatkérő-
          kártyájával egyező márka-nyelven (sötét panel + izzó accent-szín),
          oldalanként a saját `accent` színében. */}
      <section
        className={`relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28 transition-all duration-300 ease-out ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden bg-[#F2F3F5]">
          {locale === "en" ? <EuropeMapBackground /> : <HungaryMapBackground />}
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {breadcrumbItems.length > 0 && (
            <Breadcrumb
              items={breadcrumbItems}
              homeLabel={t("landing.breadcrumbHome")}
              homePath={localizePath("/", locale)}
              navLabel={t("landing.breadcrumbNavLabel")}
            />
          )}
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
            {/* Bal oszlop — fő üzenet.
                `min-w-0` KRITIKUS itt — enélkül egy hosszú, kötőjel nélküli
                összetett szó a `h1`-ben (pl. "Rendezvényszállítás", a 6
                oldal közül a leghosszabb egybeírt szó) a grid `1.1fr`
                track-jét a saját min-content szélességére kényszeríti, ami
                ELVESZI a helyet a `0.9fr` jobb oszloptól — pontosan ez
                okozta, hogy a Rendezvényszállítás oldal kamion-kártyája
                észrevehetően kisebb volt a többinél, holott mindkét oszlop
                explicit `fr` arányt kapott (a `fr` egység alapból nem megy
                a tartalom min-content mérete alá, csak ha ezt explicit
                felülírjuk). */}
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full text-[13px] font-[Overpass_Mono] font-bold uppercase tracking-[0.16em] mb-6"
                style={{ backgroundColor: `${accent}1F`, color: shade(accent, -8) }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                  style={{ backgroundColor: accent }}
                ></span>
                {eyebrow}
              </span>
              <h1 className="font-[Overpass] font-extrabold text-[2.6rem] sm:text-5xl md:text-6xl leading-[1.03] text-[#181B1F] tracking-tight text-balance">
                {h1}
              </h1>
              <p className="text-lg md:text-xl text-[#23262B]/85 leading-relaxed max-w-xl mt-6 text-balance">
                {intro}
              </p>
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4 mt-8">
                <a
                  href="#ajanlatkeres"
                  className="relative inline-flex items-center gap-2 px-8 py-4 text-white font-[Overpass] font-bold rounded-xl overflow-hidden shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: accent, boxShadow: `0 20px 35px -15px ${accent}80` }}
                >
                  <span className="svcpage-cta-shimmer absolute inset-0 pointer-events-none"></span>
                  <span className="relative">{t("servicePage.ctaButton")}</span>
                  <PiArrowRightLight className="relative" />
                </a>
                <a
                  href="tel:+36308115776"
                  className="inline-flex items-center gap-2 text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#23262B] transition-colors duration-300"
                >
                  <PiPhoneLight className="text-base" style={{ color: accent }} />
                  {t("servicePage.callPrefix")}{" "}
                  <span className="font-[Overpass_Mono]">+36 30 811 5776</span>
                </a>
              </div>
            </div>

            {/* Jobb oszlop — VALÓDI kamion-fotó (nem szintetikus sötét
                gradiens-kártya). Visszajelzés (2026-09-21): a szintetikus
                sötét gradiens-kártya "nagyon AI-os hatást keltett" — ez
                pontosan a frontend-design skill által nevesített egyik
                generikus AI-alapértelmezés. A cég saját, valódi kamion-
                fotója (`/kamion-orszagut-szikora-transz.jpg`, a "SZIKORA
                TRANSZ" felirat jól látszik a fülkén) sokkal hitelesebb.
                A fotó `aspect-[4/3]`-a a forrás-fotó tényleges 1200×900
                pixelméretét tükrözi, hogy az `object-cover` ne vágjon le
                semmit — a teljes kamion mindig látszik.
                A szöveg (korábban külön panelen a fotó ALATT, majd korábban
                még előbb a teljes szélességben a fotó ALJÁRA úsztatva)
                most VISSZAKERÜLT a fotóra, de csak a jobb ~62%-ára — a
                kamion fülkéje (a fotó bal oldalán, a márkanévvel) mindig
                szabadon, szöveg nélkül marad, csak a pótkocsi ponyvája
                fölött van a sötétítő elmosás, amin a fehér szöveg olvasható.
                Ezzel a fotó marad a kártya EGÉSZE (nincs külön alsó panel,
                ami "kisebbé" tenné a kamiont a szöveghez képest — most a
                kamion tölti ki a teljes kártyát, a szöveg csak egy
                rárétegzett sáv). */}
            <div className="relative min-w-0 rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <picture>
                <source srcSet="/kamion-orszagut-szikora-transz.webp" type="image/webp" />
                <img
                  src="/kamion-orszagut-szikora-transz.jpg"
                  alt={`${eyebrow} — Szikora Transz kamion`}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </picture>
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(140deg, ${accent}33 0%, transparent 50%)` }}
              ></div>
              <div
                className="absolute inset-y-0 right-0 w-[62%]"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, rgba(10,12,16,0.55) 32%, rgba(10,12,16,0.92) 100%)`,
                }}
              ></div>
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${accent}, ${shade(accent, 30)})` }}
              ></div>

              <div className="absolute inset-y-0 right-0 w-[62%] flex flex-col justify-end p-6 md:p-7">
                <div className="flex items-center gap-2 mb-2.5">
                  {Icon && (
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: `${accent}35`, color: "white" }}
                    >
                      <Icon />
                    </span>
                  )}
                  <span
                    className="text-[10px] font-[Overpass_Mono] font-bold uppercase tracking-[0.16em]"
                    style={{ color: shade(accent, 42) }}
                  >
                    {eyebrow}
                  </span>
                </div>
                <h2 className="font-[Overpass] font-extrabold text-xl leading-tight text-white mb-2.5 text-balance">
                  {currentServiceLabel || eyebrow}
                </h2>
                {bullets.length > 0 && (
                  <div className="space-y-1.5">
                    {bullets.slice(0, 2).map((b) => (
                      <div key={b.title} className="flex items-center gap-2 text-[13px] font-medium text-white/90">
                        <PiCheckLight className="flex-shrink-0" style={{ color: shade(accent, 48) }} />
                        <span className="text-balance">{b.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* MIÉRT MINKET — a főoldal FEATURES-kártyáival egyező, kiemelt/
            hover-lift kártyás megjelenés (korábban egy sima ikon+szöveg sor
            volt), hogy ez a szekció is a főoldaléhoz hasonlóan látványos
            legyen, ne egy annál jóval visszafogottabb lista. Korábban
            ennek a szekciónak — egyedül az oldalon — nem volt saját
            eyebrow+cím párja, csak egyenesen a kártyarács indult. */}
        {bullets.length > 0 && (
          <section className="py-14 border-t border-[#23262B]/10">
            <div className="max-w-2xl mb-10">
              <span
                className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {t("servicePage.whyUsEyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-[#23262B] mt-3">
                {t("servicePage.whyUsTitle")}
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {bullets.map((b, index) => (
                <Reveal key={b.title} delay={index * 80}>
                  <div
                    className="group h-full flex items-start gap-4 bg-white border rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    style={{ borderColor: "rgba(35,38,43,0.1)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}80`)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(35,38,43,0.1)")}
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-300"
                      style={{ backgroundColor: `${accent}1A`, color: accent }}
                    >
                      <PiCheckLight />
                    </span>
                    <div>
                      <h3 className="font-[Overpass] font-bold text-[#23262B]">{b.title}</h3>
                      <p className="text-[#23262B]/70 text-sm mt-1">{b.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* RÓLUNK — visszajelzés (2026-09-21): "legyen pár mondat megint a
            csapatról" + valódi kamion-fotó. A `landing.about.*` fordítás
            (cégtörténet + két "tiles" pont: karbantartott flotta / tapasztalt
            sofőrök) már létezik és jóváhagyott a Landing.js "Rólunk"
            szekciójából — itt csak ÚJRAHASZNOSÍTVA jelenik meg (nem új,
            kitalált szöveg), ugyanazzal a `t("landing.about.*")` kulccsal.
            A fotó (`kamionflotta-szikora-transz`, a MÁSIK valódi céges kép,
            eltérő a hero-ban használt kamiontól, hogy ne ismétlődjön ugyanaz
            a kép kétszer egy oldalon) ugyanaz, amit a Landing.js "Miért
            válasszon minket" blokkja is használ. */}
        <section className="py-14 border-t border-[#23262B]/10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] order-2 lg:order-1">
              <picture>
                <source srcSet="/kamionflotta-szikora-transz.webp" type="image/webp" />
                <img
                  src="/kamionflotta-szikora-transz.jpg"
                  alt={t("landing.about.imageAlt")}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-[#23262B]/40 via-transparent to-transparent"></div>
            </div>
            <div className="order-1 lg:order-2">
              <span
                className="text-xs font-[Overpass_Mono] font-bold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {t("landing.about.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-[#23262B] mt-3 mb-5">
                {t("landing.about.title")}
              </h2>
              <p className="text-[#23262B]/80 leading-relaxed mb-4">{t("landing.about.paragraph1")}</p>
              <p className="text-[#23262B]/80 leading-relaxed mb-6">{t("landing.about.paragraph2")}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {t("landing.about.tiles").map((tile, index) => (
                  <div
                    key={tile.title}
                    className="flex items-center gap-3 rounded-xl border border-[#23262B]/10 bg-white p-4"
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accent}1A`, color: accent }}
                    >
                      {index === 0 ? <PiTruckLight /> : <PiUserCircleLight />}
                    </span>
                    <div>
                      <div className="font-[Overpass] font-semibold text-sm text-[#23262B]">{tile.title}</div>
                      <div className="text-xs text-[#23262B]/60">{tile.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {children}

        <RouteDivider />

        {/* REFERENCIÁK */}
        <section className="py-14 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
            {t("servicePage.testimonialsTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {shownTestimonials.map((testimonial, index) => (
              <Reveal key={testimonial.name} delay={index * 80}>
                <div className="bg-white border border-[#23262B]/10 rounded-xl p-6 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-3" />
                  <p className="text-[#23262B]/75 text-sm leading-relaxed mb-5 flex-grow">{testimonial.quote}</p>
                  <div className="text-sm pt-3 border-t border-[#23262B]/10">
                    <div className="font-[Overpass] font-semibold text-[#23262B]">{testimonial.name}</div>
                    <div className="text-[#23262B]/50 text-xs">
                      {testimonial.role}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-xs text-[#23262B]/35 mt-6 max-w-2xl">{t("servicePage.testimonialsDisclaimer")}</p>
        </section>

        {/* GYIK */}
        {faqItems.length > 0 && (
          <section className="py-14 border-t border-[#23262B]/10">
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

        <RouteDivider />

        {/* AJÁNLATKÉRÉS */}
        <section id="ajanlatkeres" className="py-14 border-t border-[#23262B]/10">
          <QuoteForm />
        </section>

        {/* EGYÉB SZOLGÁLTATÁSOK */}
        <section className="py-14 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass_Mono] text-xs uppercase tracking-[0.2em] text-[#23262B]/50 mb-4">
            {t("servicePage.otherServicesTitle")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {otherServices.map((s) => (
              <Link
                key={s.path}
                to={localizePath(s.path, locale)}
                className="px-4 py-2 rounded-full border border-[#23262B]/15 bg-white text-sm font-[Overpass] font-medium text-[#23262B]/70 transition-all duration-300 hover:border-[#1E3AA8]/50 hover:text-[#1E3AA8] hover:shadow-md hover:-translate-y-0.5"
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
