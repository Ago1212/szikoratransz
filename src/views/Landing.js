import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Footer from "components/Footers/Footer.js";
import { fetchAction } from "utils/fetchAction";

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
      const sections = ["home", "services", "about", "contact"];
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
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-gray-900 bg-opacity-90 backdrop-blur-sm shadow-lg transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link
                className="text-white text-lg font-bold hover:text-lightBlue-400 transition-colors duration-300"
                to="/"
                onClick={(e) => {
                  e.preventDefault();
                  smoothScroll("home");
                }}
              >
                <span className="text-lightBlue-400">Szikora</span> Transz Kft
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-8">
                {[
                  { id: "home", label: "Kezdőlap" },
                  { id: "services", label: "Szolgáltatások" },
                  { id: "about", label: "Rólunk" },
                  { id: "contact", label: "Kapcsolat" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => smoothScroll(item.id)}
                    className={`${
                      activeSection === item.id
                        ? "text-lightBlue-400 border-b-2 border-lightBlue-400"
                        : "text-gray-300 hover:text-white"
                    } px-1 py-2 text-sm font-medium transition-colors duration-300`}
                  >
                    {item.label}
                  </button>
                ))}

                <Link
                  to="/auth/login"
                  className="bg-lightBlue-500 hover:bg-lightBlue-600 text-gray-900 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300"
                >
                  Bejelentkezés
                </Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
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

        {/* Mobile menu */}
        <div
          className={`md:hidden ${mobileMenuOpen ? "block" : "hidden"}`}
          id="mobile-menu"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-800">
            {[
              { id: "home", label: "Kezdőlap" },
              { id: "services", label: "Szolgáltatások" },
              { id: "about", label: "Rólunk" },
              { id: "contact", label: "Kapcsolat" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => smoothScroll(item.id)}
                className={`${
                  activeSection === item.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                } block px-3 py-2 rounded-md text-base font-medium w-full text-left`}
              >
                {item.label}
              </button>
            ))}

            <Link
              to="/auth/login"
              className="block w-full px-3 py-2 rounded-md text-base font-medium text-gray-900 bg-lightBlue-500 hover:bg-lightBlue-600 text-center mt-2"
            >
              Bejelentkezés
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section
          id="home"
          className="relative pt-24 pb-32 flex items-center justify-center min-h-screen"
        >
          {/* Video background */}
          <div className="absolute inset-0 overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/road.mp4" type="video/mp4" />
              <img
                src="/sample.png"
                alt="Kamion az autópályán"
                className="w-full h-full object-cover"
              />
            </video>
            <div className="absolute inset-0 bg-black opacity-40"></div>
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6">
                <span>Szikora Transz</span> Kft
              </h1>
              <p className="text-xl md:text-2xl text-gray-200 mb-8">
                Megbízható fuvarozási szolgáltatások belföldön és nemzetközileg.
                Professzionális megoldások, precíz végrehajtás.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => smoothScroll("contact")}
                  className="px-8 py-3 bg-lightBlue-500 hover:bg-lightBlue-600 text-gray-900 font-bold rounded-lg shadow-lg hover:shadow-xl transition duration-300"
                >
                  Ajánlatkérés
                </button>
                <button
                  onClick={() => smoothScroll("services")}
                  className="px-8 py-3 bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900 font-bold rounded-lg transition duration-300"
                >
                  Szolgáltatások
                </button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 w-full h-24 pointer-events-none">
            <svg
              className="absolute bottom-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
            >
              <path
                fill="#f3f4f6"
                fillOpacity="1"
                d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              ></path>
            </svg>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-20 bg-gray-100 -mt-1">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Szolgáltatásaink
              </h2>
              <div className="w-20 h-1 bg-lightBlue-500 mx-auto mb-6"></div>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Teljes körű fuvarozási megoldások, amelyek kielégítik ügyfeleink
                egyedi igényeit
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105">
                <div className="p-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <i className="fas fa-truck text-blue-600 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                    Belföldi fuvarozás
                  </h3>
                  <p className="text-gray-600 text-center">
                    Gyors és megbízható áruszállítás Magyarország egész
                    területén. Rugalmas árazás és pontos határidők.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105">
                <div className="p-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <i className="fas fa-globe-europe text-green-600 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                    Nemzetközi szállítás
                  </h3>
                  <p className="text-gray-600 text-center">
                    Határon átnyúló fuvarozási szolgáltatás Európa-szerte.
                    Vámtudás és hivatalos ügyintézés.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105">
                <div className="p-6">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <i className="fas fa-shield-alt text-purple-600 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                    Biztosított szállítás
                  </h3>
                  <p className="text-gray-600 text-center">
                    Minden fuvarunk teljes biztosítási fedezettel történik.
                    Árukádat biztonságban tudhatja nálunk.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-20 flex flex-col lg:flex-row items-center">
              <div className="lg:w-1/2 mb-10 lg:mb-0 lg:pr-10">
                <h3 className="text-3xl font-bold text-gray-900 mb-6">
                  Miért válasszon minket?
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  10+ éves tapasztalattal rendelkezünk a fuvarozási iparágban.
                  Flottánk állandóan karban van tartva, sofőreink képzettek és
                  megbízhatóak.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-check text-lightBlue-600"></i>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-lg font-semibold text-gray-900">
                        Kiváló minőség
                      </h4>
                      <p className="text-gray-600">
                        Minden szállítási folyamat precíz tervezéssel és
                        végrehajtással.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-check text-lightBlue-600"></i>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-lg font-semibold text-gray-900">
                        Rugalmasság
                      </h4>
                      <p className="text-gray-600">
                        Személyre szabott megoldások minden egyedi igényre.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2">
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src="/sample.png"
                    alt="Flottánk"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-6">
                    <h4 className="text-xl font-bold text-white mb-2">
                      Modern flotta
                    </h4>
                    <p className="text-gray-200">
                      Több modern, karbantartott kamionból álló flottánk és
                      tapasztalt sofőreink garantálják a megbízható szállítást.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center">
              <div className="lg:w-1/2 mb-10 lg:mb-0 lg:pr-10">
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src="/sample.png"
                    alt="Cégünkről"
                    className="w-full h-auto"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 lg:pl-10">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Cégtörténetünk
                </h2>
                <div className="w-20 h-1 bg-lightBlue-500 mb-6"></div>
                <p className="text-lg text-gray-600 mb-6">
                  Szikora Transz Kft 2010-ben alakult kis családi
                  vállalkozásként. Azóta folyamatosan bővült flottánk és
                  szolgáltatási körünk, de megtartottuk személyes hangvételünket
                  és ügyfélközpontú hozzáállásunkat.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-truck-moving text-blue-600"></i>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Modern flotta
                      </h4>
                      <p className="text-gray-600">
                        Több modern kamionból álló, állandóan karbantartott
                        flotta.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-user-tie text-green-600"></i>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Tapasztalt sofőrök
                      </h4>
                      <p className="text-gray-600">
                        Több tapasztalt, hosszú távú sofőr alkotja csapatunkat.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 bg-gray-900 text-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Számokban kifejezve
              </h2>
              <div className="w-20 h-1 bg-lightBlue-500 mx-auto mb-6"></div>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Büszkék vagyunk eredményeinkre és ügyfeleink elégedettségére
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-lightBlue-400 mb-2">
                  10+
                </div>
                <div className="text-gray-300">Év tapasztalat</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-lightBlue-400 mb-2">
                  50+
                </div>
                <div className="text-gray-300">Elégedett ügyfél</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-lightBlue-400 mb-2">
                  100%
                </div>
                <div className="text-gray-300">Biztosított szállítás</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-lightBlue-400 mb-2">
                  24/7
                </div>
                <div className="text-gray-300">Ügyfélszolgálat</div>
              </div>
            </div>
          </div>
        </section>
        {/*
        {/* Partners Section 
        <section id="partners" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Partnereink
              </h2>
              <div className="w-20 h-1 bg-lightBlue-500 mx-auto mb-6"></div>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Büszkék vagyunk kiváló partnereinkre, akikkel együtt dolgozunk
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              {[
                { logo: "/dreher.png", name: "Dreher" },
                { logo: "/transzdanubia.png", name: "TranszDanubia" },
                { logo: "/engelmayer.png", name: "Engelmayer" },
              ].map((partner, index) => (
                <div
                  key={index}
                  className="w-40 h-24 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-xl transition duration-300 flex items-center justify-center"
                >
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-full max-w-full object-contain grayscale hover:grayscale-0 transition duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
/*}
        {/* Contact Section */}
        <section id="contact" className="py-20 bg-gray-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Kapcsolatfelvétel
              </h2>
              <div className="w-20 h-1 bg-lightBlue-500 mx-auto mb-6"></div>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Kérjük töltse ki az alábbi űrlapot, és hamarosan válaszolunk
              </p>
            </div>

            {/* Submit status message */}
            {submitStatus.message && (
              <div
                className={`mb-8 mx-auto max-w-2xl p-4 rounded-lg text-center ${
                  submitStatus.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Quote Request Form */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-[1.01]">
                <div className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                      <i className="fas fa-envelope text-blue-600 text-xl"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Ajánlatkérés
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Küldjön üzenetet, és 24 órán belül visszajelzünk részletes
                    ajánlattal.
                  </p>

                  <form onSubmit={submitQuoteRequest}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={quoteForm.name}
                          onChange={handleQuoteChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-300"
                          placeholder="Teljes név"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Telefonszám
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={quoteForm.phone}
                            onChange={handleQuoteChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-300"
                            placeholder="Telefonszám"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email cím
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={quoteForm.email}
                            onChange={handleQuoteChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-300"
                            placeholder="Email cím"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Üzenet
                        </label>
                        <textarea
                          rows="4"
                          name="message"
                          value={quoteForm.message}
                          onChange={handleQuoteChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-300"
                          placeholder="Üzenet szövege..."
                          required
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition duration-300 disabled:opacity-50"
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
                        "Üzenet küldése"
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Driver Application Form */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-[1.01]">
                <div className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                      <i className="fas fa-truck text-yellow-600 text-xl"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Sofőr jelentkezés
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Csatlakozzon profi sofőr csapatunkhoz!
                  </p>

                  <form onSubmit={submitDriverApplication}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={applicationForm.name}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-lightBlue-500 transition duration-300"
                          placeholder="Teljes név"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Telefonszám
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={applicationForm.phone}
                            onChange={handleApplicationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition duration-300"
                            placeholder="Telefonszám"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email cím
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={applicationForm.email}
                            onChange={handleApplicationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition duration-300"
                            placeholder="Email cím"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Üzenet
                        </label>
                        <textarea
                          rows="4"
                          name="message"
                          value={applicationForm.message}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition duration-300"
                          placeholder="Üzenet szövege..."
                          required
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-lg shadow-md hover:shadow-lg transition duration-300 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
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
    </>
  );
}
