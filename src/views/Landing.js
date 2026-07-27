/**
 * Szikora Transz Kft — prémium logisztikai landing page
 *
 * Overpass / Overpass Mono globálisan betöltve (public/index.html) és
 * beállítva a Tailwind alapértelmezett font-sans / font-mono családjaként.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Footer from "components/Footers/Footer.js";
import { fetchAction } from "utils/fetchAction";
import HungaryMapBackground from "components/UI/HungaryMapBackground.js";
import QuoteForm from "components/Landing/QuoteForm.js";
import {
  FEATURES,
  PROCESS_STEPS,
  TESTIMONIALS,
  FAQ_ITEMS,
} from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";
import { useSeo } from "utils/useSeo.js";
import {
  PiTruckLight,
  PiArrowRightLight,
  PiCheckLight,
  PiUserCircleLight,
  PiQuotesLight,
  PiCaretDownLight,
  PiIdentificationCardLight,
} from "react-icons/pi";

// ---------------------------------------------------------------------------
// Design tokens (Tailwind arbitrary values — nem igényel config módosítást)
// paper:      #F2F3F5  (visszafogott törtfehér, az elsődleges/domináns háttér)
// ink:        #23262B  (antracit szürke, elsődleges szövegszín világos háttéren
//             + néhány szándékosan sötét kiemelő panel háttere)
// panel:      #2E3239  (sötét panel / kártya háttér, pl. hero ajánlatkérő kártya)
// accent:     #1E3AA8  (mélykék, az elsődleges kiemelő szín világos hátterek előtt)
// accentHover:#172E86  (accent hover/aktív állapota)
// accentBright: #2F4DE0 (élénkebb kék — csak sötét paneleken, ahol a mélykék
//             kontrasztja gyenge lenne: hero kártya, kapcsolat form, footer.
//             Háttérként (pl. ikon /15 tint) használjuk; olvasandó szöveghez/
//             ikonszínhez sötét panelen a világosabb #7C93FF árnyalatot
//             használjuk, mert a #2F4DE0 önmagában ~2:1 kontrasztarányú
//             a #2E3239/#23262B hátterekhez képest — a #7C93FF ~4.6:1-et ad)
// ---------------------------------------------------------------------------

function RouteDivider({ dark = false }) {
  return (
    <div className="relative max-w-5xl mx-auto px-4 py-2">
      <div
        className={`absolute left-4 right-4 top-1/2 border-t-2 border-dashed ${
          dark ? "border-white/10" : "border-[#23262B]/10"
        }`}
      ></div>
      <div className="relative flex justify-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center border ${
            dark
              ? "bg-[#23262B] border-white/10"
              : "bg-[#F2F3F5] border-[#23262B]/10"
          }`}
        >
          <PiTruckLight className="text-xs text-[#1E3AA8]" />
        </div>
      </div>
    </div>
  );
}

// Egyszerű, függőségmentes "felbukkanó" animáció — akkor jelenik meg egy elem,
// amikor görgetés közben a képernyőre kerül. A `prefers-reduced-motion`
// beállítást tiszteletben tartja.
function Reveal({ children, delay = 0, className = "", variant = "fade" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // "pop" variant hozzáad egy finom scale + blur átmenetet is — a hero
  // kiemelt elemeinek (pl. ajánlatkérő kártya) szánva, hogy erősebb
  // belépő hatást adjon, mint az egyszerű fade+translate.
  const hidden =
    variant === "pop"
      ? "opacity-0 translate-y-6 scale-[0.96] blur-sm"
      : "opacity-0 translate-y-6";
  const shown =
    variant === "pop"
      ? "opacity-100 translate-y-0 scale-100 blur-0"
      : "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? shown : hidden
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Stabil objektum-referencia a Landing route hreflang-alternatíváihoz —
// statikus (nem függ propoktól/state-től), ezért modul-szinten, nem
// useMemo-val hozzuk létre; `localizePath` adja a HU→EN leképezést, hogy ne
// legyen kézzel felírt "/en" string (ld. ServicePage.js/Adatvedelem.js
// ugyanezen mintája).
const HOME_ALTERNATES = { hu: localizePath("/", "hu"), en: localizePath("/", "en") };

export default function Landing() {
  const { t, locale } = useTranslation();
  useSeo({
    // HU szándékosan `undefined` — a `public/index.html` statikus,
    // SEO-auditált title/description marad érvényben; a
    // `landing.homeMeta` HU értékei csak dokumentációs/EN-fallback célból
    // léteznek, nem kerülnek ténylegesen felhasználásra.
    title: locale === "en" ? t("landing.homeMeta.title") : undefined,
    description: locale === "en" ? t("landing.homeMeta.description") : undefined,
    path: localizePath("/", locale),
    lang: locale,
    alternates: HOME_ALTERNATES,
  });
  const [activeSection, setActiveSection] = useState("home");
  const [applicationForm, setApplicationForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({
    success: null,
    message: "",
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const handleApplicationChange = (e) => {
    const { name, value } = e.target;
    setApplicationForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitDriverApplication = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ success: null, message: "" });

    const result = await fetchAction("sendJelentkezes", {
      name: applicationForm.name,
      phone: applicationForm.phone,
      email: applicationForm.email,
      message: applicationForm.message,
    });

    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message: t("landing.contact.driverForm.successMessage"),
      });
      setApplicationForm({ name: "", phone: "", email: "", message: "" });
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || t("landing.contact.driverForm.errorMessageDefault"),
      });
    }
    setIsSubmitting(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "folyamat", "services", "about", "contact"];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetHeight = element.offsetHeight;

          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const smoothScroll = (id) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth",
      });
    }
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const navItems = [
    { id: "home", label: t("landing.nav.home") },
    { id: "services", label: t("landing.nav.services") },
    { id: "about", label: t("landing.nav.about") },
    { id: "contact", label: t("landing.nav.contact") },
  ];

  return (
    <div className="font-sans">
      {/* ---------------------------------------------------------------- */}
      {/* NAVIGÁCIÓ                                                        */}
      {/* ---------------------------------------------------------------- */}
      <nav className="fixed top-0 w-full z-50 bg-[#F2F3F5]/90 backdrop-blur-sm border-b border-[#23262B]/8 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link
                to={localizePath("/", locale)}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScroll("home");
                }}
              >
                <img
                  src="/logo2.svg"
                  alt="Szikora Transz Kft"
                  width="1600"
                  height="578"
                  className="h-9 md:h-10 w-auto"
                  fetchpriority="high"
                />
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-8">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      smoothScroll(item.id);
                    }}
                    className={`${
                      activeSection === item.id
                        ? "text-[#1E3AA8] border-b-2 border-[#1E3AA8]"
                        : "text-[#23262B]/70 hover:text-[#23262B] border-b-2 border-transparent"
                    } px-1 py-2 text-sm font-medium transition-colors duration-300`}
                  >
                    {item.label}
                  </a>
                ))}

                <Link
                  to="/auth/login"
                  className="bg-[#1E3AA8] hover:bg-[#172E86] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-300"
                >
                  {t("landing.nav.login")}
                </Link>
                <span className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide ml-4">
                  <Link
                    to={localizePath("/", "hu")}
                    className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
                  >
                    HU
                  </Link>
                  <span className="text-[#23262B]/30">|</span>
                  <Link
                    to={localizePath("/", "en")}
                    className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
                  >
                    EN
                  </Link>
                </span>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-xl text-[#23262B]/70 hover:text-[#23262B] hover:bg-[#23262B]/5 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded="false"
              >
                <span className="sr-only">{t("landing.nav.menuToggleSr")}</span>
                {mobileMenuOpen ? (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`md:hidden ${mobileMenuOpen ? "block" : "hidden"}`}
          id="mobile-menu"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-[#F2F3F5] border-t border-[#23262B]/8">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScroll(item.id);
                }}
                className={`${
                  activeSection === item.id
                    ? "bg-[#23262B]/5 text-[#1E3AA8]"
                    : "text-[#23262B]/70 hover:bg-[#23262B]/5 hover:text-[#23262B]"
                } block px-3 py-2 rounded-xl text-base font-medium w-full text-left`}
              >
                {item.label}
              </a>
            ))}

            <Link
              to="/auth/login"
              className="block w-full px-3 py-2 rounded-xl text-base font-semibold text-white bg-[#1E3AA8] hover:bg-[#172E86] text-center mt-2"
            >
              {t("landing.nav.login")}
            </Link>
            <div className="flex items-center justify-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide pt-2">
              <Link to={localizePath("/", "hu")} className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50"}>
                HU
              </Link>
              <span className="text-[#23262B]/30">|</span>
              <Link to={localizePath("/", "en")} className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50"}>
                EN
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* ---------------------------------------------------------- */}
        {/* HERO                                                        */}
        {/* ---------------------------------------------------------- */}
        <section
          id="home"
          className="relative pt-16 pb-12 lg:pt-40 lg:pb-32 flex items-center lg:min-h-screen overflow-hidden bg-[#F2F3F5]"
        >
          <div className="absolute inset-0 overflow-hidden bg-[#F2F3F5]">
            <style>{`
              @keyframes lineReveal {
                from { opacity: 0; transform: translateY(112%); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes shimmerSweep {
                0% { background-position: 160% 0; }
                35%, 100% { background-position: -60% 0; }
              }
              .hero-line-mask { display: block; overflow: hidden; }
              .hero-line-inner {
                display: inline-block;
                animation: lineReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
              }
              .hero-cta-shimmer {
                background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
                background-size: 200% 100%;
                animation: shimmerSweep 3.8s ease-in-out infinite;
                animation-delay: 1.6s;
              }
              @media (prefers-reduced-motion: reduce) {
                .hero-line-inner, .hero-cta-shimmer {
                  animation: none;
                }
              }
            `}</style>
            <HungaryMapBackground />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-16 items-start">
              {/* Bal oszlop — fő üzenet */}
              <div className="relative">
                <Reveal delay={0}>
                  <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8] mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E3AA8] animate-pulse"></span>
                    {t("landing.hero.eyebrow")}
                  </span>
                </Reveal>

                <h1 className="font-[Overpass] font-extrabold text-4xl md:text-7xl leading-[1.05] text-[#23262B] tracking-tight">
                  {/* Szóköz minden sor-span között: a `.hero-line-mask` maga
                      display:block-kel vizuálisan úgyis külön sorra töri
                      ezeket, de szóköz nélkül a nyers DOM-szöveg (amit pl.
                      a JS-t nem futtató keresőrobotok/AI-crawlerek látnak)
                      egybefolyna: "Szállítás, amirepercre pontosan...". */}
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner"
                      style={{ animationDelay: "120ms" }}
                    >
                      {t("landing.hero.headline.line1")}
                    </span>
                  </span>{" "}
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner text-[#1E3AA8]"
                      style={{ animationDelay: "260ms" }}
                    >
                      {t("landing.hero.headline.line2")}
                    </span>
                  </span>{" "}
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner"
                      style={{ animationDelay: "400ms" }}
                    >
                      {t("landing.hero.headline.line3")}
                    </span>
                  </span>
                </h1>

                <Reveal delay={520}>
                  <p className="text-lg text-[#23262B]/70 max-w-xl text-balance">
                    {t("landing.hero.subheading")}
                  </p>
                </Reveal>

                <Reveal delay={780}>
                  <a
                    href="#services"
                    onClick={(e) => {
                      e.preventDefault();
                      smoothScroll("services");
                    }}
                    className="mt-6 inline-flex items-center gap-2 text-[#23262B]/70 hover:text-[#23262B] text-sm font-[Overpass] font-semibold transition-colors duration-300"
                  >
                    {t("landing.hero.servicesLink")}
                    <PiArrowRightLight className="text-xs" />
                  </a>
                </Reveal>
              </div>

              {/* Jobb oszlop — ajánlatkérés a középpontban (signature elem) */}
              <Reveal
                delay={150}
                className="relative bg-[#2E3239]/90 backdrop-blur-md border border-white/10 rounded-xl p-6 md:p-10 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E3AA8] to-[#172E86]"></div>

                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-white">
                  {t("landing.hero.quoteCard.eyebrow")}
                </span>
                <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-white mt-3 mb-3">
                  {t("landing.hero.quoteCard.title")}
                </h2>
                <p className="text-white/60 mb-4 md:mb-6">{t("landing.hero.quoteCard.subtitle")}</p>

                <div className="space-y-2 mb-5 md:space-y-3 md:mb-8">
                  {t("landing.hero.quoteCard.bullets").map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-white/70"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#2F4DE0]/15 text-[#7C93FF] flex items-center justify-center flex-shrink-0">
                        <PiCheckLight className="text-[10px]" />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => smoothScroll("contact")}
                  className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
                >
                  {t("landing.hero.quoteCard.ctaButton")}
                </button>

                <p className="text-center text-xs text-white/55 mt-5">
                  {t("landing.hero.quoteCard.callPrefix")}{" "}
                  <a
                    href="tel:+36308115776"
                    className="text-white/70 hover:text-[#7C93FF] font-[Overpass_Mono]"
                  >
                    +36 30 811 5776
                  </a>
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* FOLYAMAT                                                    */}
        {/* ---------------------------------------------------------- */}
        <section id="folyamat" className="py-24 bg-[#F2F3F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.process.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.process.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.process.intro")}</p>
            </div>

            <div className="relative grid md:grid-cols-4 gap-12 md:gap-8">
              <div className="hidden md:block absolute left-7 right-[calc(25%-3.25rem)] top-7 border-t-2 border-dashed border-[#23262B]/15"></div>
              {PROCESS_STEPS.map((step, index) => (
                <Reveal key={step.id} delay={index * 100} className="relative">
                  <div className="relative z-10 w-14 h-14 rounded-full bg-[#1E3AA8] text-white flex items-center justify-center font-[Overpass_Mono] font-bold border-4 border-[#F2F3F5] mb-5">
                    {step.n}
                  </div>
                  <p className="font-[Overpass] font-bold text-lg text-[#23262B] mb-2">
                    {t(`landing.processSteps.${step.id}.title`)}
                  </p>
                  <p className="text-[#23262B]/70 text-sm leading-relaxed">
                    {t(`landing.processSteps.${step.id}.desc`)}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* SZOLGÁLTATÁSOK                                              */}
        {/* ---------------------------------------------------------- */}
        <section id="services" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.services.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.services.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.services.intro")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature, index) => {
                return (
                  <Reveal key={feature.id} delay={index * 80}>
                    {/* A kártya maga NEM link — csak a cím (h3) az, egy
                        `after:absolute after:inset-0` "stretched link"
                        trükkel kiterjesztve a teljes kártyára (a `relative`
                        a kártyán maga adja a pozicionálási kontextust). Ez
                        SEO-szempontból lényeges: korábban a teljes kártya
                        (cím+leírás+"Részletek") egyetlen linkként a teljes
                        bekezdést anchor textként adta ki (150-210 karakter),
                        amit egy SEO-audit "túl hosszú belső link-anchor
                        szöveg"-ként jelzett — most az anchor szövege csak a
                        rövid, egyedi cím, a teljes kártya kattinthatósága
                        (UX) viszont megmarad. */}
                    <div className="group relative bg-white border border-[#23262B]/10 rounded-xl p-8 h-full transition-all duration-300 hover:border-[#1E3AA8]/50 hover:shadow-xl hover:-translate-y-1">
                      <div className="w-12 h-12 bg-[#1E3AA8]/10 text-[#1E3AA8] rounded-xl flex items-center justify-center mb-6">
                        <feature.icon className="text-lg" />
                      </div>
                      <h3 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
                        {feature.href ? (
                          <Link
                            to={localizePath(feature.href, locale)}
                            className="after:content-[''] after:absolute after:inset-0"
                          >
                            {t(`landing.features.${feature.id}.title`)}
                          </Link>
                        ) : (
                          t(`landing.features.${feature.id}.title`)
                        )}
                      </h3>
                      <p className="text-[#23262B]/70 leading-relaxed">
                        {t(`landing.features.${feature.id}.desc`)}
                      </p>
                      {feature.href && (
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-[Overpass] font-semibold text-[#1E3AA8] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {t("landing.services.detailsLink")}
                          <PiArrowRightLight className="text-xs" />
                        </span>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* Miért válasszon minket */}
            <div className="mt-24 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  {t("landing.services.whyUs.eyebrow")}
                </span>
                <h3 className="font-[Overpass] font-extrabold text-3xl text-[#23262B] mt-3 mb-6">
                  {t("landing.services.whyUs.title")}
                </h3>
                <p className="text-lg text-[#23262B]/70 mb-8">{t("landing.services.whyUs.intro")}</p>
                <div className="space-y-4">
                  {t("landing.services.whyUs.bullets").map((item, index) => (
                    <Reveal key={item.title} delay={index * 80}>
                      <div className="flex items-start gap-4 border-l-2 border-dashed border-[#1E3AA8]/40 pl-5 py-1">
                        <div>
                          <p className="font-[Overpass] font-bold text-[#23262B]">
                            {item.title}
                          </p>
                          <p className="text-[#23262B]/70 text-sm mt-1">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-[4/3]">
                <picture>
                  <source srcSet="/kamionflotta-szikora-transz.webp" type="image/webp" />
                  <img
                    src="/kamionflotta-szikora-transz.jpg"
                    alt={t("landing.services.whyUs.imageAlt")}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#23262B] via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <p className="font-[Overpass] font-bold text-xl text-white mb-1">
                    {t("landing.services.whyUs.imageCaption.title")}
                  </p>
                  <p className="text-white/70 text-sm">{t("landing.services.whyUs.imageCaption.desc")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <RouteDivider />

        {/* ---------------------------------------------------------- */}
        {/* RÓLUNK                                                      */}
        {/* ---------------------------------------------------------- */}
        <section id="about" className="py-24 bg-[#F2F3F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-[4/3] order-2 lg:order-1">
                <picture>
                  <source srcSet="/kamion-orszagut-szikora-transz.webp" type="image/webp" />
                  <img
                    src="/kamion-orszagut-szikora-transz.jpg"
                    alt={t("landing.about.imageAlt")}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-[#23262B]/20"></div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  {t("landing.about.eyebrow")}
                </span>
                <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3 mb-6">
                  {t("landing.about.title")}
                </h2>
                <p className="text-lg text-[#23262B]/70 mb-4">{t("landing.about.paragraph1")}</p>
                <p className="text-lg text-[#23262B]/70 mb-8">{t("landing.about.paragraph2")}</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <PiTruckLight />
                    </div>
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        {t("landing.about.tiles")[0].title}
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">{t("landing.about.tiles")[0].desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <PiUserCircleLight />
                    </div>
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        {t("landing.about.tiles")[1].title}
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">{t("landing.about.tiles")[1].desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* REFERENCIÁK                                                 */}
        {/* ---------------------------------------------------------- */}
        <section id="referenciak" className="py-24 bg-[#F2F3F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.testimonials.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.testimonials.title")}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, index) => (
                <Reveal key={testimonial.id} delay={index * 100}>
                  <div className="bg-white border border-[#23262B]/10 rounded-xl p-8 flex flex-col h-full">
                    <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-4" />
                    <p className="text-[#23262B]/75 leading-relaxed mb-6 flex-grow">
                      {t(`landing.testimonialItems.${testimonial.id}.quote`)}
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[#23262B]/10">
                      <div className="w-11 h-11 rounded-full bg-[#23262B] text-white flex items-center justify-center font-[Overpass_Mono] font-bold text-sm flex-shrink-0">
                        {testimonial.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-[Overpass] font-semibold text-[#23262B] text-sm">
                          {testimonial.name}
                        </div>
                        <div className="text-[#23262B]/50 text-xs">
                          {t(`landing.testimonialItems.${testimonial.id}.role`)},{" "}
                          {t(`landing.testimonialItems.${testimonial.id}.company`)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="text-xs text-[#23262B]/35 mt-8 max-w-2xl">{t("landing.testimonials.disclaimer")}</p>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* GYIK                                                        */}
        {/* ---------------------------------------------------------- */}
        {/* FAQPage strukturált adat — a lenti FAQ_ITEMS-ből generálva, hogy
            sose fusson szét a látható tartalomtól. Ez teszi jogosulttá az
            oldalt a Google FAQ rich resultjára, és könnyebben idézhetővé
            AI-összefoglalók számára. */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: t(`landing.faqItems.${item.id}.q`),
              acceptedAnswer: {
                "@type": "Answer",
                text: t(`landing.faqItems.${item.id}.a`),
              },
            })),
          })}
        </script>
        <section id="gyik" className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.faq.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.faq.title")}
              </h2>
            </div>

            <div className="divide-y divide-[#23262B]/10 border-t border-b border-[#23262B]/10">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.id}>
                    <h3>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 py-6 text-left font-[Overpass] font-semibold text-[#23262B] text-lg"
                      >
                        {t(`landing.faqItems.${item.id}.q`)}
                        <PiCaretDownLight
                          className={`text-[#1E3AA8] text-sm flex-shrink-0 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </h3>
                    {isOpen && (
                      <p className="text-[#23262B]/70 leading-relaxed pb-6 pr-8">
                        {t(`landing.faqItems.${item.id}.a`)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* KAPCSOLAT / AJÁNLATKÉRÉS                                    */}
        {/* ---------------------------------------------------------- */}
        <section id="contact" className="py-24 bg-[#F2F3F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.contact.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.contact.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.contact.intro")}</p>
            </div>

            {submitStatus.message && (
              <div
                className={`mb-8 max-w-3xl p-4 rounded-xl text-sm font-medium ${
                  submitStatus.success
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8">
              {/* Ajánlatkérés — elsődleges, kiemelt űrlap (kiemelve a
                  components/Landing/QuoteForm.js komponensbe, hogy a
                  szolgáltatás-specifikus long-tail oldalak is
                  újrahasználhassák ugyanazt a submit-logikát). */}
              <QuoteForm />

              {/* Sofőr jelentkezés — másodlagos, de tudatosan vonzóvá tett
                  űrlap: konkrét (a felhasználóval egyeztetett) előnyök +
                  a jogosítvány-követelmény előre, hogy a jelentkező már a
                  kitöltés előtt lássa, számára szól-e az ajánlat, és mit
                  nyer vele. A zöld (emerald) tónus szándékos, nem
                  tetszőleges szín-választás: a kimenő e-mail sablonok
                  (backend/interface/emailInterface.php TONES) már ma is
                  "positive/emerald" jelvénnyel küldik a sofőr-jelentkezési
                  visszaigazolást — ez a kártya ugyanazt a szemantikát hozza
                  vizuálisan a landing oldalra is. Szándékosan NEM a
                  QuoteForm sötét #2E3239 "signature" kártyaszíne — az a
                  bevétel-generáló ajánlatkérésnek van fenntartva, hogy a két
                  form vizuálisan is jelezze, melyik az elsődleges konverziós
                  cél az oldalon. */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
                <div className="p-8">
                  <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-emerald-700 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    {t("landing.contact.driverForm.eyebrow")}
                  </span>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <PiTruckLight className="text-lg" />
                    </div>
                    <h3 className="font-[Overpass] font-bold text-xl text-[#23262B]">
                      {t("landing.contact.driverForm.title")}
                    </h3>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    {t("landing.contact.driverForm.benefits").map((elony) => (
                      <div key={elony} className="flex items-start gap-2.5 text-sm text-[#23262B]/70">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <PiCheckLight className="text-[11px]" />
                        </span>
                        {elony}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2.5 bg-white/70 border border-emerald-200/70 rounded-lg px-3.5 py-2.5 mb-6">
                    <PiIdentificationCardLight className="text-emerald-700 text-base flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#23262B]/60">
                      <span className="font-semibold text-[#23262B]/80">
                        {t("landing.contact.driverForm.requirementPrefix")}{" "}
                      </span>
                      {t("landing.contact.driverForm.requirementText")}
                    </p>
                  </div>

                  <p className="text-[#23262B]/50 mb-6 text-sm">{t("landing.contact.driverForm.intro")}</p>

                  <form onSubmit={submitDriverApplication}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.nameLabel")}
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={applicationForm.name}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.namePlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.phoneLabel")}
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={applicationForm.phone}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.phonePlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.emailLabel")}
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={applicationForm.email}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.emailPlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.messageLabel")}
                        </label>
                        <textarea
                          rows="3"
                          name="message"
                          value={applicationForm.message}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.messagePlaceholder")}
                          required
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 px-6 py-3 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white font-[Overpass] font-bold uppercase tracking-wide text-sm rounded-xl transition duration-300 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {t("landing.contact.driverForm.submitLoading")}
                        </span>
                      ) : (
                        t("landing.contact.driverForm.submitDefault")
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
