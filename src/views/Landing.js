import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// components
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
      setIsSubmitting(false);
    } else {
      setSubmitStatus({ success: false, message: result.message });
      setIsSubmitting(false);
    }
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
      setIsSubmitting(false);
    } else {
      setSubmitStatus({ success: false, message: result.message });
      setIsSubmitting(false);
    }
  };

  // Handle scroll to detect current section
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "services", "about", "partners", "contact"];
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

  // Smooth scroll function
  const smoothScroll = (id) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth",
      });
    }
  };
  return (
    <>
      {" "}
      <nav className="fixed top-0 w-full z-50 bg-blueGray-900 bg-opacity-90 backdrop-blur-sm shadow-lg">
        <div className="w-full mx-auto items-center flex justify-between md:flex-nowrap flex-wrap md:px-10 px-4 py-3">
          {/* Brand/logo */}
          <Link
            className="text-white text-sm uppercase hidden lg:inline-block font-semibold hover:text-yellow-300 transition-colors duration-300"
            to="/"
            onClick={(e) => {
              e.preventDefault();
              smoothScroll("home");
            }}
          >
            Szikora Transz Kft
          </Link>

          {/* Navigation links */}
          <ul className="flex flex-nowrap space-x-4 md:flex-row items-center space-y-0 md:space-x-8">
            {[
              { id: "home", label: "Kezdőlap" },
              { id: "services", label: "Szolgáltatások" },
              { id: "about", label: "Rólunk" },
              { id: "partners", label: "Partnereink" },
              { id: "contact", label: "Kapcsolat" },
            ].map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => smoothScroll(item.id)}
                  className={`${
                    activeSection === item.id ? "text-yellow-300" : "text-white"
                  } hover:text-yellow-300 text-xs uppercase py-1 md:py-3 font-bold block transition-colors duration-300`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Login button (right side) */}
          <ul className="flex-col md:flex-row flex items-center">
            <li>
              <Link
                to="/auth/login"
                className="bg-white text-blueGray-700 hover:bg-yellow-300 text-xs font-bold uppercase px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none lg:mr-1 lg:mb-0 ml-3 mb-3 transition-all duration-300"
              >
                Bejelentkezés
              </Link>
            </li>
          </ul>
        </div>
      </nav>
      <main>
        <div
          id="home"
          className="relative pt-16 pb-32 flex content-center items-center justify-center min-h-screen-75"
        >
          {/* Videó háttér */}
          <div className="absolute top-0 w-full h-full overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover"
            >
              <source src="/road.mp4" type="video/mp4" />
              <img
                src="/sample.png"
                alt="Kamion az autópályán"
                className="w-full h-full object-cover"
              />
            </video>
            <span className="w-full h-full absolute top-0 left-0 bg-black opacity-30"></span>
          </div>

          <div className="container relative mx-auto">
            <div className="items-center flex flex-wrap">
              <div className="w-full lg:w-6/12 px-4 ml-auto mr-auto text-center">
                <div className="pr-12">
                  <h1
                    className="text-white font-semibold text-5xl"
                    dangerouslySetInnerHTML={{
                      __html: "Szikora Transz",
                    }}
                  />
                  <p className="mt-6 text-lg text-blueGray-200">
                    Megbízható fuvarozási szolgáltatások, professzionális
                    árufuvarozás belföldön és nemzetközileg. Több kamionból és
                    tapasztalt sofőrökből álló flottánkkal mindig a
                    rendelkezésére állunk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="top-auto bottom-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden h-70-px"
            style={{ transform: "translateZ(0)" }}
          >
            <svg
              className="absolute bottom-0 overflow-hidden"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              version="1.1"
              viewBox="0 0 2560 100"
              x="0"
              y="0"
            >
              <polygon
                className="text-blueGray-200 fill-current"
                points="2560 0 2560 100 0 100"
              ></polygon>
            </svg>
          </div>
        </div>

        <section id="services" className="pb-20 bg-blueGray-200 -mt-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap">
              <div className="lg:pt-12 pt-6 w-full md:w-4/12 px-4 text-center">
                <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-8 shadow-lg rounded-lg">
                  <div className="px-4 py-5 flex-auto">
                    <div className="text-white p-3 text-center inline-flex items-center justify-center w-12 h-12 mb-5 shadow-lg rounded-full bg-red-400">
                      <i className="fas fa-truck"></i>
                    </div>
                    <h2 className="text-xl font-semibold">
                      Belföldi fuvarozás
                    </h2>
                    <p className="mt-2 mb-4 text-blueGray-500">
                      Gyors és megbízható áruszállítás Magyarország egész
                      területén. Rugalmas árazás és pontos határidők.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-4/12 px-4 text-center">
                <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-8 shadow-lg rounded-lg">
                  <div className="px-4 py-5 flex-auto">
                    <div className="text-white p-3 text-center inline-flex items-center justify-center w-12 h-12 mb-5 shadow-lg rounded-full bg-lightBlue-400">
                      <i className="fas fa-globe-europe"></i>
                    </div>
                    <h2 className="text-xl font-semibold">
                      Nemzetközi szállítás
                    </h2>
                    <p className="mt-2 mb-4 text-blueGray-500">
                      Határon átnyúló fuvarozási szolgáltatás Európa-szerte.
                      Vámtudás és hivatalos ügyintézés.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 w-full md:w-4/12 px-4 text-center">
                <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-8 shadow-lg rounded-lg">
                  <div className="px-4 py-5 flex-auto">
                    <div className="text-white p-3 text-center inline-flex items-center justify-center w-12 h-12 mb-5 shadow-lg rounded-full bg-emerald-400">
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <h2 className="text-xl font-semibold">
                      Biztosított szállítás
                    </h2>
                    <p className="mt-2 mb-4 text-blueGray-500">
                      Minden fuvarunk teljes biztosítási fedezettel történik.
                      Árukádat biztonságban tudhatja nálunk.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center mt-32">
              <div className="w-full md:w-5/12 px-4 mr-auto ml-auto">
                <div className="text-blueGray-500 p-3 text-center inline-flex items-center justify-center w-16 h-16 mb-6 shadow-lg rounded-full bg-white">
                  <i className="fas fa-warehouse text-xl"></i>
                </div>
                <h3 className="text-3xl mb-2 font-semibold leading-normal">
                  Miért minket válasszon?
                </h3>
                <p className="text-lg font-light leading-relaxed mt-4 mb-4 text-blueGray-600">
                  10+ éves tapasztalattal rendelkezünk a fuvarozási iparágban.
                  Flottánk állandóan karban van tartva, sofőreink képzettek és
                  megbízhatóak.
                </p>
                <p className="text-lg font-light leading-relaxed mt-0 mb-4 text-blueGray-600">
                  Ügyfeleink számára személyre szabott megoldásokat kínálunk,
                  figyelembe véve egyedi igényeiket és határidőiket.
                </p>
              </div>

              <div className="w-full md:w-4/12 px-4 mr-auto ml-auto ">
                <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-lightBlue-500">
                  <img
                    alt="..."
                    src="/sample.png"
                    className="w-full align-middle rounded-t-lg"
                  />
                  <blockquote className="relative p-8 mb-4 bg-lightBlue-500">
                    <svg
                      preserveAspectRatio="none"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 583 95"
                      className="absolute left-0 w-full block h-95-px -top-94-px"
                    >
                      <polygon
                        points="-30,95 583,95 583,65"
                        className="text-lightBlue-500 fill-current"
                      ></polygon>
                    </svg>
                    <h4 className="text-xl font-bold text-white">Flottánk</h4>
                    <p className="text-md font-light mt-2 text-white">
                      Több modern, karbantartott kamionból álló flottánk és
                      tapasztalt, hosszú távú sofőreink garantálja a megbízható
                      szállítást.
                    </p>
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="relative py-20 bg-white">
          <div
            className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-24"
            style={{ height: "100px", transform: "translateZ(0)" }}
          >
            <svg
              className="absolute bottom-0 overflow-hidden"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              version="1.1"
              viewBox="0 0 2560 100"
              x="0"
              y="0"
            >
              <polygon
                className="text-white fill-current"
                points="2560 0 2560 100 0 100"
              ></polygon>
            </svg>
          </div>

          <div className="container mx-auto px-4">
            <div className="items-center flex flex-wrap">
              <div className="w-full md:w-4/12 ml-auto mr-auto px-4">
                <img
                  alt="..."
                  className="max-w-full rounded-lg shadow-lg"
                  src="/sample.png"
                />
              </div>
              <div className="w-full md:w-5/12 ml-auto mr-auto px-4">
                <div className="md:pr-12">
                  <div className="text-lightBlue-600 p-3 text-center inline-flex items-center justify-center w-16 h-16 mb-6 shadow-lg rounded-full bg-lightBlue-300">
                    <i className="fas fa-road text-xl"></i>
                  </div>
                  <h3 className="text-3xl font-semibold">Cégtörténetünk</h3>
                  <p className="mt-4 text-lg leading-relaxed text-blueGray-500">
                    Szikora Transz Kft 2010-ben alakult kis családi
                    vállalkozásként. Azóta folyamatosan bővült flottánk és
                    szolgáltatási körünk, de megtartottuk személyes
                    hangvételünket és ügyfélközpontú hozzáállásunkat.
                  </p>
                  <ul className="list-none mt-6">
                    <li className="py-2">
                      <div className="flex items-center">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-lightBlue-600 bg-lightBlue-200 mr-3">
                            <i className="fas fa-truck-moving"></i>
                          </span>
                        </div>
                        <div>
                          <h4 className="text-blueGray-500">
                            Több modern kamionból álló flotta
                          </h4>
                        </div>
                      </div>
                    </li>
                    <li className="py-2">
                      <div className="flex items-center">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-lightBlue-600 bg-lightBlue-200 mr-3">
                            <i className="fas fa-user-tie"></i>
                          </span>
                        </div>
                        <div>
                          <h4 className="text-blueGray-500">
                            Több tapasztalt, hosszú távú sofőr
                          </h4>
                        </div>
                      </div>
                    </li>
                    <li className="py-2">
                      <div className="flex items-center">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-lightBlue-600 bg-lightBlue-200 mr-3">
                            <i className="fas fa-map-marked-alt"></i>
                          </span>
                        </div>
                        <div>
                          <h4 className="text-blueGray-500">
                            Belföldi és nemzetközi fuvarozás
                          </h4>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="relative block py-20 bg-blueGray-800">
          <div
            className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-24"
            style={{ height: "100px", transform: "translateZ(0)" }}
          >
            <svg
              className="absolute bottom-0 overflow-hidden "
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              version="1.1"
              viewBox="0 0 2560 100"
              x="0"
              y="0"
            >
              <polygon
                className="text-blueGray-800 fill-current"
                points="2560 0 2560 100 0 100"
              ></polygon>
            </svg>
          </div>

          <div className="container mx-auto px-4 lg:pt-24 lg:pb-32 ">
            <div className="flex flex-wrap text-center justify-center">
              <div className="w-full lg:w-6/12 px-4">
                <h2 className="text-4xl font-semibold text-white">
                  Miben vagyunk jók?
                </h2>
                <div className="flex justify-center mt-4">
                  <div className="w-24 h-1 bg-yellow-400 rounded"></div>
                </div>
                <p className="text-lg leading-relaxed mt-4 mb-4 text-blueGray-400">
                  Szikora Transz Kft a megbízható és pontos fuvarozás
                  hagyományait követi. Ügyfeleink elégedettsége mindennapos
                  motivációnk.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap mt-12 justify-center">
              <div className="w-full lg:w-3/12 px-4 text-center">
                <div className="text-blueGray-800 p-3 w-12 h-12 shadow-lg rounded-full bg-white inline-flex items-center justify-center">
                  <i className="fas fa-clock text-xl"></i>
                </div>
                <h3 className="text-xl mt-5 font-semibold text-white">
                  Pontosság
                </h3>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Mindig időben érkezünk és teljesítjük ígéreteinket. Határidők
                  betartása nálunk alapvető elv.
                </p>
              </div>
              <div className="w-full lg:w-3/12 px-4 text-center">
                <div className="text-blueGray-800 p-3 w-12 h-12 shadow-lg rounded-full bg-white inline-flex items-center justify-center">
                  <i className="fas fa-euro-sign text-xl"></i>
                </div>
                <h3 className="text-xl mt-5 font-semibold text-white">
                  Versenyképes árak
                </h3>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Áraink a piaci viszonyoknak megfelelőek, miközben nem
                  veszítünk a minőségből.
                </p>
              </div>
              <div className="w-full lg:w-3/12 px-4 text-center">
                <div className="text-blueGray-800 p-3 w-12 h-12 shadow-lg rounded-full bg-white inline-flex items-center justify-center">
                  <i className="fas fa-headset text-xl"></i>
                </div>
                <h3 className="text-xl mt-5 font-semibold text-white">
                  Ügyfélszolgálat
                </h3>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Szakértő csapatunk mindig rendelkezésére áll kérdéseivel,
                  problémáival kapcsolatban.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* Új Partnereink szekció */}

        <section
          id="partners"
          className="relative block pb-20  bg-blueGray-800"
        >
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center text-center mb-12">
              <div className="w-full lg:w-6/12 px-4">
                <h2 className="text-4xl font-semibold text-white">
                  Partnereink
                </h2>
                <div className="flex justify-center mt-4">
                  <div className="w-24 h-1 bg-yellow-400 rounded"></div>
                </div>
                <p className="mt-4 text-lg text-white">
                  Büszkék vagyunk kiváló partnereinkre, akikkel együtt dolgozunk
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {/* Partner logo 1 */}
              <div className="w-32 md:w-40 p-3 bg-white/80 rounded-lg shadow hover:bg-white transition-all duration-300 grayscale hover:grayscale-0">
                <img
                  src="/dreher.png"
                  alt="Partner 1"
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* Partner logo 2 */}
              <div className="w-32 md:w-40 p-3 bg-white/80 rounded-lg shadow hover:bg-white transition-all duration-300 grayscale hover:grayscale-0">
                <img
                  src="/transzdanubia.png"
                  alt="Partner 2"
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* Partner logo 3 */}
              <div className="w-32 md:w-40 p-3 bg-white/80 rounded-lg shadow hover:bg-white transition-all duration-300 grayscale hover:grayscale-0">
                <img
                  src="/engelmayer.png"
                  alt="Partner 3"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>
        <section
          id="contact"
          className="relative block pt-20 pb-24 bg-blueGray-800"
        >
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center lg:-mt-0 -mt-0">
              <div className="w-full px-4">
                {/* Formok fejléc */}
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-semibold text-white mb-4">
                    Kapcsolatfelvétel
                  </h2>
                  <div className="flex justify-center">
                    <div className="w-24 h-1 bg-yellow-400 rounded"></div>
                  </div>
                </div>

                {/* Submit status message */}
                {submitStatus.message && (
                  <div
                    className={`mb-8 text-center p-4 rounded-lg ${
                      submitStatus.success
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {submitStatus.message}
                  </div>
                )}

                {/* Formok konténer - árnyékokkal és térbeli elválasztással */}
                <div className="flex flex-wrap justify-center lg:flex-nowrap lg:space-x-8">
                  {/* Ajánlatkérés űrlap - kék hangsúlyokkal */}
                  <div className="w-full lg:w-1/2 mb-8 lg:mb-0 transform hover:scale-101 transition duration-300">
                    <form
                      onSubmit={submitQuoteRequest}
                      className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-t-4 border-blue-500"
                    >
                      <div className="flex-auto p-8">
                        <div className="flex items-center mb-6">
                          <div className="bg-blue-100 p-3 rounded-full mr-4">
                            <i className="fas fa-envelope text-blue-600 text-xl"></i>
                          </div>
                          <h3 className="text-2xl font-bold text-blueGray-800">
                            Ajánlatkérés
                          </h3>
                        </div>
                        <p className="leading-relaxed mb-6 text-blueGray-600">
                          Küldjön üzenetet, és 24 órán belül visszajelzünk
                          részletes ajánlattal.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                              Teljes név
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={quoteForm.name}
                              onChange={handleQuoteChange}
                              className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              placeholder="Teljes név"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                                Telefonszám
                              </label>
                              <input
                                type="tel"
                                name="phone"
                                value={quoteForm.phone}
                                onChange={handleQuoteChange}
                                className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-orange-500 w-full"
                                placeholder="Telefonszám"
                                required
                              />
                            </div>

                            <div>
                              <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                                Email cím
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={quoteForm.email}
                                onChange={handleQuoteChange}
                                className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                                placeholder="Email cím"
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                              Üzenet
                            </label>
                            <textarea
                              rows="3"
                              name="message"
                              value={quoteForm.message}
                              onChange={handleQuoteChange}
                              className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              placeholder="Üzenet szövege..."
                              required
                            />
                          </div>
                        </div>

                        <div className="text-center mt-8">
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1 disabled:opacity-50"
                            type="submit"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Küldés..." : "Üzenet küldése"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Középső elválasztó - csak nagy képernyőn látszik */}
                  <div className="hidden lg:block">
                    <div className="h-full w-1 bg-blueGray-700 mx-4 rounded-full relative">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-blueGray-900 font-bold py-2 px-4 rounded-full">
                        VAGY
                      </div>
                    </div>
                  </div>

                  {/* Sofőr jelentkezés űrlap - narancs hangsúlyokkal */}
                  <div className="w-full lg:w-1/2 transform hover:scale-101 transition duration-300">
                    <form
                      onSubmit={submitDriverApplication}
                      className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-t-4 border-orange-500"
                    >
                      <div className="flex-auto p-8">
                        <div className="flex items-center mb-6">
                          <div className="bg-orange-100 p-3 rounded-full mr-4">
                            <i className="fas fa-truck text-orange-600 text-xl"></i>
                          </div>
                          <h3 className="text-2xl font-bold text-blueGray-800">
                            Sofőr jelentkezés
                          </h3>
                        </div>
                        <p className="leading-relaxed mb-6 text-blueGray-600">
                          Csatlakozzon profi sofőr csapatunkhoz!
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                              Teljes név
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={applicationForm.name}
                              onChange={handleApplicationChange}
                              className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-orange-500 w-full"
                              placeholder="Teljes név"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                                Telefonszám
                              </label>
                              <input
                                type="tel"
                                name="phone"
                                value={applicationForm.phone}
                                onChange={handleApplicationChange}
                                className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-orange-500 w-full"
                                placeholder="Telefonszám"
                                required
                              />
                            </div>

                            <div>
                              <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                                Email cím
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={applicationForm.email}
                                onChange={handleApplicationChange}
                                className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                                placeholder="Email cím"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
                              Üzenet
                            </label>
                            <textarea
                              rows="3"
                              name="message"
                              value={applicationForm.message}
                              onChange={handleApplicationChange}
                              className="border-0 px-4 py-3 placeholder-blueGray-300 text-blueGray-700 bg-blueGray-100 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                              placeholder="Üzenet szövege..."
                              required
                            />
                          </div>
                        </div>

                        <div className="text-center mt-8">
                          <button
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1 disabled:opacity-50"
                            type="submit"
                            disabled={isSubmitting}
                          >
                            {isSubmitting
                              ? "Küldés..."
                              : "Jelentkezés elküldése"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
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
