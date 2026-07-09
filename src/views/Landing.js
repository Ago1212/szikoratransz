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
          <i className="fas fa-truck text-xs text-[#1E3AA8]"></i>
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

const FAQ_ITEMS = [
  {
    q: "Mennyi idő alatt kapok ajánlatot?",
    a: "Általában 24 órán belül felvesszük Önnel a kapcsolatot egy részletes, az útvonalra és az áru jellegére szabott árajánlattal.",
  },
  {
    q: "Biztosított a szállított áru?",
    a: "Igen, minden fuvarunk teljes körű biztosítási fedezettel történik, a felvételtől a kiszállításig.",
  },
  {
    q: "Vállalnak nemzetközi szállítást?",
    a: "Igen, Európa-szerte végzünk nemzetközi fuvarozást, a szükséges vámügyintézés és okmányolás teljes körű intézésével.",
  },
  {
    q: "Kérhetek egyedi árajánlatot speciális igényekhez?",
    a: "Igen, minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Vegye fel velünk a kapcsolatot a részletekkel, és személyre szabott ajánlatot küldünk.",
  },
  {
    q: "Milyen fizetési feltételeket fogadnak el?",
    a: "Átutalást és számlás fizetést is biztosítunk, a fizetési határidőt az egyedi megrendelés alapján egyeztetjük.",
  },
  {
    q: "Hogyan jelentkezhetek sofőrként?",
    a: "Töltse ki az alábbi jelentkezési űrlapot a végzettségével és tapasztalatával, csapatunk hamarosan felveszi Önnel a kapcsolatot.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "A Szikora Transz csapatára mindig számíthatunk, akár sürgős, akár előre tervezett szállításról van szó. A kommunikáció gyors és pontos.",
    name: "Nagy Péter",
    role: "beszerzési vezető",
    company: "Pannon Élelmiszer Zrt.",
  },
  {
    quote:
      "Nemzetközi fuvarjaink mindig időben és hiánytalanul érkeznek meg. A vámügyintézést is teljes egészében átvállalják tőlünk.",
    name: "Tóth Andrea",
    role: "logisztikai menedzser",
    company: "ÉszakBau Kft.",
  },
  {
    quote:
      "Minden fuvarra gyorsan, az igényeinkre szabott árajánlatot kapunk, és bármikor el tudjuk érni a csapatot, ha kérdésünk van.",
    name: "Kovács Gábor",
    role: "ügyvezető",
    company: "Dunapack Csomagolástechnika Kft.",
  },
];

const FEATURES = [
  {
    icon: "fa-truck",
    title: "Belföldi fuvarozás",
    desc: "Gyors és megbízható áruszállítás Magyarország egész területén, rugalmas árazással és pontos határidőkkel.",
  },
  {
    icon: "fa-globe-europe",
    title: "Nemzetközi szállítás",
    desc: "Határon átnyúló fuvarozási szolgáltatás Európa-szerte, teljes körű vámügyintézéssel és okmányolással.",
  },
  {
    icon: "fa-shield-alt",
    title: "Biztosított szállítás",
    desc: "Minden fuvarunk teljes biztosítási fedezettel történik — az árukészlete nálunk biztos kezekben van.",
  },
  {
    icon: "fa-warehouse",
    title: "Raktározás és logisztika",
    desc: "Rövid és hosszú távú tárolási kapacitás, áru-átcsomagolás és teljes körű logisztikai koordináció.",
  },
  {
    icon: "fa-bolt",
    title: "Expressz szállítás",
    desc: "Sürgős fuvarok soron kívüli kezelése, garantált kiszállítási idővel, ha az idő a legfontosabb tényező.",
  },
  {
    icon: "fa-file-invoice",
    title: "Egyedi árajánlat",
    desc: "Minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján — gyors, személyre szabott ajánlattal.",
  },
];

const PROCESS_STEPS = [
  {
    n: "01",
    title: "Megrendelés",
    desc: "Küldje el ajánlatkérését az űrlapon, és 24 órán belül részletes választ kap tőlünk.",
  },
  {
    n: "02",
    title: "Tervezés",
    desc: "Optimalizáljuk az útvonalat, és kiválasztjuk az áru jellegéhez illő járművet és sofőrt.",
  },
  {
    n: "03",
    title: "Szállítás",
    desc: "Szakképzett sofőreink pontosan az ütemterv szerint szállítják az árut, az ország határain belül és kívül.",
  },
  {
    n: "04",
    title: "Kézbesítés",
    desc: "Pontos, biztosított kiszállítás, írásos visszaigazolással a fuvar lezárásáról.",
  },
];

export default function Landing() {
  const [activeSection, setActiveSection] = useState("home");
  const [quoteForm, setQuoteForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
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

  const handleQuoteChange = (e) => {
    const { name, value } = e.target;
    setQuoteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplicationChange = (e) => {
    const { name, value } = e.target;
    setApplicationForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitQuoteRequest = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ success: null, message: "" });

    const result = await fetchAction("sendAjanlatkeres", {
      name: quoteForm.name,
      email: quoteForm.email,
      phone: quoteForm.phone,
      message: quoteForm.message,
    });

    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message:
          "Ajánlatkérés sikeresen elküldve! Hamarosan felvesszük Önnel a kapcsolatot.",
      });
      setQuoteForm({ name: "", email: "", phone: "", message: "" });
    } else {
      setSubmitStatus({
        success: false,
        message:
          result.message || "Hiba történt az ajánlatkérés küldése közben.",
      });
    }
    setIsSubmitting(false);
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
        message:
          "Jelentkezés sikeresen elküldve! Hamarosan felvesszük Önnel a kapcsolatot.",
      });
      setApplicationForm({ name: "", phone: "", email: "", message: "" });
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || "Hiba történt a jelentkezés küldése közben.",
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
    { id: "home", label: "Kezdőlap" },
    { id: "services", label: "Szolgáltatások" },
    { id: "about", label: "Rólunk" },
    { id: "contact", label: "Kapcsolat" },
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
                to="/"
                onClick={(e) => {
                  e.preventDefault();
                  smoothScroll("home");
                }}
              >
                <img
                  src="/logo.png"
                  alt="Szikora Transz Kft"
                  className="h-9 md:h-10 w-auto"
                />
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-8">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => smoothScroll(item.id)}
                    className={`${
                      activeSection === item.id
                        ? "text-[#1E3AA8] border-b-2 border-[#1E3AA8]"
                        : "text-[#23262B]/60 hover:text-[#23262B] border-b-2 border-transparent"
                    } px-1 py-2 text-sm font-medium transition-colors duration-300`}
                  >
                    {item.label}
                  </button>
                ))}

                <Link
                  to="/auth/login"
                  className="bg-[#1E3AA8] hover:bg-[#172E86] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-300"
                >
                  Bejelentkezés
                </Link>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-xl text-[#23262B]/60 hover:text-[#23262B] hover:bg-[#23262B]/5 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded="false"
              >
                <span className="sr-only">Menü megnyitása</span>
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
              <button
                key={item.id}
                onClick={() => smoothScroll(item.id)}
                className={`${
                  activeSection === item.id
                    ? "bg-[#23262B]/5 text-[#1E3AA8]"
                    : "text-[#23262B]/60 hover:bg-[#23262B]/5 hover:text-[#23262B]"
                } block px-3 py-2 rounded-xl text-base font-medium w-full text-left`}
              >
                {item.label}
              </button>
            ))}

            <Link
              to="/auth/login"
              className="block w-full px-3 py-2 rounded-xl text-base font-semibold text-white bg-[#1E3AA8] hover:bg-[#172E86] text-center mt-2"
            >
              Bejelentkezés
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ---------------------------------------------------------- */}
        {/* HERO                                                        */}
        {/* ---------------------------------------------------------- */}
        <section
          id="home"
          className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 flex items-center min-h-screen overflow-hidden bg-[#F2F3F5]"
        >
          <div className="absolute inset-0 overflow-hidden bg-[#F2F3F5]">
            <style>{`
              @keyframes routeFlow {
                to { stroke-dashoffset: -200; }
              }
              @keyframes waypointPulse {
                0%, 100% { opacity: 0.45; transform: scale(1); }
                50% { opacity: 0.85; transform: scale(1.3); }
              }
              @keyframes heroMapIn {
                from { opacity: 0; transform: scale(1.06); filter: blur(14px); }
                to { opacity: 1; transform: scale(1); filter: blur(0); }
              }
              @keyframes orbFloat {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(-14px, 22px); }
              }
              @keyframes orbFloatDelay {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(18px, -18px); }
              }
              @keyframes lineReveal {
                from { opacity: 0; transform: translateY(112%); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes shimmerSweep {
                0% { background-position: 160% 0; }
                35%, 100% { background-position: -60% 0; }
              }
              .route-flow-1 { animation: routeFlow 14s linear infinite; }
              .route-flow-2 { animation: routeFlow 22s linear infinite reverse; }
              .route-flow-3 { animation: routeFlow 18s linear infinite; }
              .waypoint-pulse {
                transform-box: fill-box;
                transform-origin: center;
                animation: waypointPulse 4s ease-in-out infinite;
              }
              .waypoint-pulse-delay { animation-delay: 1.8s; }
              .hero-map-in { animation: heroMapIn 1.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
              .hero-orb-1 { animation: orbFloat 9s ease-in-out infinite; }
              .hero-orb-2 { animation: orbFloatDelay 11s ease-in-out infinite; }
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
                .route-flow-1, .route-flow-2, .route-flow-3, .waypoint-pulse,
                .hero-map-in, .hero-orb-1, .hero-orb-2, .hero-line-inner, .hero-cta-shimmer {
                  animation: none;
                }
              }
            `}</style>
            <div className="absolute inset-0 hero-map-in">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 900px 550px at 85% -10%, rgba(30,58,168,0.10), transparent 60%)",
                }}
              ></div>
              <svg
                viewBox="0 0 1440 900"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <path
                  className="route-flow-1"
                  d="M-50,620 C 250,260 470,300 760,440 C 1020,230 1260,400 1520,160"
                  stroke="#1E3AA8"
                  strokeWidth="2"
                  strokeDasharray="10 12"
                  fill="none"
                  opacity="0.3"
                />
                <path
                  className="route-flow-2"
                  d="M-80,180 C 220,340 520,140 820,360 C 1100,560 1320,300 1560,480"
                  stroke="#23262B"
                  strokeWidth="1.5"
                  strokeDasharray="6 10"
                  fill="none"
                  opacity="0.12"
                />
                <path
                  className="route-flow-3"
                  d="M120,900 C 420,680 600,840 900,580 C 1140,380 1300,580 1520,360"
                  stroke="#1E3AA8"
                  strokeWidth="2"
                  strokeDasharray="10 12"
                  fill="none"
                  opacity="0.18"
                />
                <circle
                  className="waypoint-pulse"
                  cx="760"
                  cy="440"
                  r="5"
                  fill="#1E3AA8"
                  opacity="0.6"
                />
                <circle
                  cx="760"
                  cy="440"
                  r="14"
                  stroke="#1E3AA8"
                  fill="none"
                  opacity="0.25"
                />
                <circle
                  className="waypoint-pulse waypoint-pulse-delay"
                  cx="900"
                  cy="580"
                  r="5"
                  fill="#1E3AA8"
                  opacity="0.5"
                />
                <circle
                  cx="1520"
                  cy="160"
                  r="4"
                  fill="#23262B"
                  opacity="0.25"
                />
                <circle cx="-50" cy="620" r="4" fill="#23262B" opacity="0.2" />
              </svg>
            </div>
            <div className="hero-orb-1 absolute -top-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-[#1E3AA8]/15 blur-3xl pointer-events-none"></div>
            <div className="hero-orb-2 absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-[#1E3AA8]/10 blur-3xl pointer-events-none"></div>
            <div className="absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay pointer-events-none"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-16 items-center">
              {/* Bal oszlop — fő üzenet */}
              <div>
                <Reveal delay={0}>
                  <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8] mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E3AA8] animate-pulse"></span>
                    Belföldi és nemzetközi fuvarozás
                  </span>
                </Reveal>

                <h1 className="font-[Overpass] font-extrabold text-5xl md:text-7xl leading-[1.05] text-[#23262B] tracking-tight">
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner"
                      style={{ animationDelay: "120ms" }}
                    >
                      Szállítás, amire
                    </span>
                  </span>
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner text-[#1E3AA8]"
                      style={{ animationDelay: "260ms" }}
                    >
                      percre pontosan
                    </span>
                  </span>
                  <span className="hero-line-mask">
                    <span
                      className="hero-line-inner"
                      style={{ animationDelay: "400ms" }}
                    >
                      számíthat.
                    </span>
                  </span>
                </h1>

                <Reveal delay={520}>
                  <p className="text-lg text-[#23262B]/70 max-w-xl mt-6 text-balance">
                    Szikora Transz Kft — belföldi és nemzetközi fuvarozás 2010
                    óta. Modern flotta, teljes körű biztosítás, és egy csapat,
                    amely minden fuvart úgy kezel, mintha a saját árujuk lenne.
                  </p>
                </Reveal>

                <Reveal delay={650}>
                  <div className="flex flex-wrap gap-x-8 gap-y-3 mt-10">
                    {[
                      "Saját flotta",
                      "EU-szerte",
                      "100% biztosított",
                      "Nincs rejtett költség",
                    ].map((item) => (
                      <span
                        key={item}
                        className="flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/60"
                      >
                        <i className="fas fa-check text-[#1E3AA8]"></i>
                        {item}
                      </span>
                    ))}
                  </div>
                </Reveal>

                <Reveal delay={780}>
                  <button
                    onClick={() => smoothScroll("services")}
                    className="mt-10 inline-flex items-center gap-2 text-[#23262B]/60 hover:text-[#23262B] text-sm font-[Overpass] font-semibold transition-colors duration-300"
                  >
                    Szolgáltatásaink megismerése
                    <i className="fas fa-arrow-right text-xs"></i>
                  </button>
                </Reveal>
              </div>

              {/* Jobb oszlop — ajánlatkérés a középpontban (signature elem) */}
              <Reveal
                delay={150}
                className="relative bg-[#2E3239]/90 backdrop-blur-md border border-white/10 rounded-xl p-8 md:p-10 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E3AA8] to-[#172E86]"></div>

                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-white">
                  Ingyenes árajánlat
                </span>
                <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-white mt-3 mb-3">
                  Kérjen árajánlatot még ma
                </h2>
                <p className="text-white/60 mb-6">
                  Töltse ki pár adatát, és 24 órán belül egyedi árajánlattal
                  válaszolunk — kötöttség nélkül.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    "Teljesen ingyenes, nem kötelez semmire",
                    "Válasz 24 órán belül",
                    "Egyedi árazás minden fuvarra",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-white/70"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#2F4DE0]/15 text-[#7C93FF] flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-check text-[10px]"></i>
                      </span>
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => smoothScroll("contact")}
                  className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
                >
                  Ingyenes ajánlatot kérek
                </button>

                <p className="text-center text-xs text-white/40 mt-5">
                  vagy hívjon közvetlenül:{" "}
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
                A folyamat
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Így jut el az árujuk A-ból B-be
              </h2>
              <p className="text-[#23262B]/60 mt-4 text-lg">
                Négy lépés, amely minden fuvarra érvényes — a megrendeléstől a
                visszaigazolt kézbesítésig.
              </p>
            </div>

            <div className="relative grid md:grid-cols-4 gap-12 md:gap-8">
              <div className="hidden md:block absolute left-0 right-0 top-7 border-t-2 border-dashed border-[#23262B]/15"></div>
              {PROCESS_STEPS.map((step, index) => (
                <Reveal key={step.n} delay={index * 100} className="relative">
                  <div className="relative z-10 w-14 h-14 rounded-full bg-[#1E3AA8] text-white flex items-center justify-center font-[Overpass_Mono] font-bold border-4 border-[#F2F3F5] mb-5">
                    {step.n}
                  </div>
                  <h3 className="font-[Overpass] font-bold text-lg text-[#23262B] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[#23262B]/60 text-sm leading-relaxed">
                    {step.desc}
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
                Szolgáltatások
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Szolgáltatásaink
              </h2>
              <p className="text-[#23262B]/60 mt-4 text-lg">
                Teljes körű fuvarozási megoldások, amelyek kielégítik ügyfeleink
                egyedi igényeit — belföldön és külföldön egyaránt.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 80}>
                  <div className="bg-white border border-[#23262B]/10 rounded-xl p-8 h-full transition-all duration-300 hover:border-[#1E3AA8]/50 hover:shadow-xl hover:-translate-y-1">
                    <div className="w-12 h-12 bg-[#1E3AA8]/10 text-[#1E3AA8] rounded-xl flex items-center justify-center mb-6">
                      <i className={`fas ${feature.icon} text-lg`}></i>
                    </div>
                    <h3 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-[#23262B]/60 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Miért válasszon minket */}
            <div className="mt-24 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  Miért mi
                </span>
                <h3 className="font-[Overpass] font-extrabold text-3xl text-[#23262B] mt-3 mb-6">
                  Miért válasszon minket?
                </h3>
                <p className="text-lg text-[#23262B]/60 mb-8">
                  10+ éves tapasztalattal rendelkezünk a fuvarozási iparágban.
                  Flottánk állandóan karban van tartva, sofőreink képzettek és
                  megbízhatóak.
                </p>
                <div className="space-y-4">
                  {[
                    {
                      title: "Kiváló minőség",
                      desc: "Minden szállítási folyamat precíz tervezéssel és végrehajtással.",
                    },
                    {
                      title: "Rugalmasság",
                      desc: "Személyre szabott megoldások minden egyedi igényre.",
                    },
                    {
                      title: "Megbízhatóság",
                      desc: "Hosszú távú partnerségek, pontos határidőkkel és átlátható kommunikációval.",
                    },
                    {
                      title: "Családias hozzáállás",
                      desc: "Családi vállalkozásként indultunk, és így is kezelünk minden ügyfelet és sofőrt: emberközpontúan, tisztelettel.",
                    },
                  ].map((item, index) => (
                    <Reveal key={item.title} delay={index * 80}>
                      <div className="flex items-start gap-4 border-l-2 border-dashed border-[#1E3AA8]/40 pl-5 py-1">
                        <div>
                          <h4 className="font-[Overpass] font-bold text-[#23262B]">
                            {item.title}
                          </h4>
                          <p className="text-[#23262B]/60 text-sm mt-1">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-[4/3]">
                <img
                  src="/flotta-1.jpg"
                  alt="Szikora Transz kamion"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#23262B] via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <h4 className="font-[Overpass] font-bold text-xl text-white mb-1">
                    Modern flotta
                  </h4>
                  <p className="text-white/70 text-sm">
                    Több modern, karbantartott kamionból álló flottánk és
                    tapasztalt sofőreink garantálják a megbízható szállítást.
                  </p>
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
                <img
                  src="/flotta-3.jpg"
                  alt="Szikora Transz kamion borult égbolt alatt"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[#23262B]/20"></div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  Rólunk
                </span>
                <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3 mb-6">
                  Cégtörténetünk
                </h2>
                <p className="text-lg text-[#23262B]/60 mb-8">
                  Szikora Transz Kft 2010-ben alakult kis családi
                  vállalkozásként. Azóta folyamatosan bővült flottánk és
                  szolgáltatási körünk, de megtartottuk személyes hangvételünket
                  és ügyfélközpontú hozzáállásunkat.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-truck-moving"></i>
                    </div>
                    <div>
                      <h4 className="font-[Overpass] font-semibold text-[#23262B]">
                        Modern flotta
                      </h4>
                      <p className="text-[#23262B]/60 text-sm">
                        Több modern kamionból álló, állandóan karbantartott
                        flotta.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-user-tie"></i>
                    </div>
                    <div>
                      <h4 className="font-[Overpass] font-semibold text-[#23262B]">
                        Tapasztalt sofőrök
                      </h4>
                      <p className="text-[#23262B]/60 text-sm">
                        Több tapasztalt, hosszú távú sofőr alkotja csapatunkat.
                      </p>
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
                Ügyfélvisszajelzések
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Amit partnereink mondanak rólunk
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((t, index) => (
                <Reveal key={t.name} delay={index * 100}>
                  <div className="bg-white border border-[#23262B]/10 rounded-xl p-8 flex flex-col h-full">
                    <i className="fas fa-quote-left text-[#1E3AA8]/30 text-2xl mb-4"></i>
                    <p className="text-[#23262B]/75 leading-relaxed mb-6 flex-grow">
                      {t.quote}
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[#23262B]/10">
                      <div className="w-11 h-11 rounded-full bg-[#23262B] text-white flex items-center justify-center font-[Overpass_Mono] font-bold text-sm flex-shrink-0">
                        {t.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-[Overpass] font-semibold text-[#23262B] text-sm">
                          {t.name}
                        </div>
                        <div className="text-[#23262B]/50 text-xs">
                          {t.role}, {t.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="text-xs text-[#23262B]/35 mt-8 max-w-2xl">
              * A fenti referenciák minta-szövegek — érdemes őket valós ügyfelek
              visszajelzéseire cserélni a publikálás előtt.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* GYIK                                                        */}
        {/* ---------------------------------------------------------- */}
        <section id="gyik" className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                Gyakran ismételt kérdések
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Kérdése van? Válaszolunk.
              </h2>
            </div>

            <div className="divide-y divide-[#23262B]/10 border-t border-b border-[#23262B]/10">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between gap-4 py-6 text-left"
                    >
                      <span className="font-[Overpass] font-semibold text-[#23262B] text-lg">
                        {item.q}
                      </span>
                      <i
                        className={`fas fa-chevron-down text-[#1E3AA8] text-sm flex-shrink-0 transition-transform duration-300 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      ></i>
                    </button>
                    {isOpen && (
                      <p className="text-[#23262B]/60 leading-relaxed pb-6 pr-8">
                        {item.a}
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
                Kapcsolat
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Kapcsolatfelvétel
              </h2>
              <p className="text-[#23262B]/60 mt-4 text-lg">
                Kérjük töltse ki az alábbi űrlapot — gyors, ingyenes és
                semmilyen kötöttséggel nem jár.
              </p>
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
              {/* Ajánlatkérés — elsődleges, kiemelt űrlap */}
              <div className="bg-[#23262B] rounded-xl overflow-hidden">
                <div className="p-8 md:p-10">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-[#2E3239]/15 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-envelope text-lg"></i>
                    </div>
                    <h3 className="font-[Overpass] font-bold text-2xl text-white">
                      Ingyenes ajánlatkérés
                    </h3>
                  </div>
                  <p className="text-white/50 mb-8">
                    Küldjön üzenetet, és 24 órán belül visszajelzünk részletes
                    ajánlattal.
                  </p>

                  <form onSubmit={submitQuoteRequest}>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={quoteForm.name}
                          onChange={handleQuoteChange}
                          className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                          placeholder="Teljes név"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2">
                            Telefonszám
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={quoteForm.phone}
                            onChange={handleQuoteChange}
                            className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                            placeholder="Telefonszám"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2">
                            Email cím
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={quoteForm.email}
                            onChange={handleQuoteChange}
                            className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                            placeholder="Email cím"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2">
                          Üzenet
                        </label>
                        <textarea
                          rows="4"
                          name="message"
                          value={quoteForm.message}
                          onChange={handleQuoteChange}
                          className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                          placeholder="Üzenet szövege..."
                          required
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-7 px-6 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold uppercase tracking-wide text-sm rounded-xl transition duration-300 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                          Küldés...
                        </span>
                      ) : (
                        "Ingyenes ajánlat kérése"
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Sofőr jelentkezés — másodlagos, barátságosabb hangvételű űrlap */}
              <div className="bg-[#1E3AA8]/[0.04] border border-[#1E3AA8]/15 rounded-xl overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-[#1E3AA8]/10 text-[#1E3AA8] rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-truck text-lg"></i>
                    </div>
                    <h3 className="font-[Overpass] font-bold text-xl text-[#23262B]">
                      Sofőr jelentkezés
                    </h3>
                  </div>
                  <p className="text-[#23262B]/50 mb-6 text-sm">
                    Csatlakozzon profi sofőr csapatunkhoz! Nem kérünk azonnal
                    önéletrajzat — írjon pár sort, és felvesszük Önnel a
                    kapcsolatot.
                  </p>

                  <form onSubmit={submitDriverApplication}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={applicationForm.name}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-[#1E3AA8]/20 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-[#1E3AA8] focus:border-[#1E3AA8] transition duration-300"
                          placeholder="Teljes név"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Telefonszám
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={applicationForm.phone}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-[#1E3AA8]/20 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-[#1E3AA8] focus:border-[#1E3AA8] transition duration-300"
                          placeholder="Telefonszám"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Email cím
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={applicationForm.email}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-[#1E3AA8]/20 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-[#1E3AA8] focus:border-[#1E3AA8] transition duration-300"
                          placeholder="Email cím"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Üzenet
                        </label>
                        <textarea
                          rows="3"
                          name="message"
                          value={applicationForm.message}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-[#1E3AA8]/20 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-[#1E3AA8] focus:border-[#1E3AA8] transition duration-300"
                          placeholder="Üzenet szövege..."
                          required
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 px-6 py-3 border-2 border-[#1E3AA8] text-[#1E3AA8] hover:bg-[#1E3AA8] hover:text-white font-[Overpass] font-bold uppercase tracking-wide text-sm rounded-xl transition duration-300 disabled:opacity-50"
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
                          Küldés...
                        </span>
                      ) : (
                        "Jelentkezés elküldése"
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
