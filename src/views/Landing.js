import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// components
import Navbar from "components/Navbars/AuthNavbar.js";
import Footer from "components/Footers/Footer.js";

export default function Landing() {
  const [activeSection, setActiveSection] = useState("home");

  // Handle scroll to detect current section
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
          <ul className="flex-col md:flex-row flex md:ml-auto md:mr-auto items-center">
            {[
              { id: "home", label: "Kezdőlap" },
              { id: "services", label: "Szolgáltatások" },
              { id: "about", label: "Rólunk" },
              { id: "contact", label: "Kapcsolat" },
            ].map((item) => (
              <li key={item.id} className="md:ml-8 md:mb-0 mb-3">
                <button
                  onClick={() => smoothScroll(item.id)}
                  className={`${
                    activeSection === item.id ? "text-yellow-300" : "text-white"
                  } hover:text-yellow-300 text-xs uppercase py-3 font-bold block transition-colors duration-300`}
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
          <div
            className="absolute top-0 w-full h-full bg-center bg-cover"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1544620347-c4fd8a51b3db?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80')",
            }}
          >
            <span
              id="blackOverlay"
              className="w-full h-full absolute opacity-75 bg-black"
            ></span>
          </div>
          <div className="container relative mx-auto">
            <div className="items-center flex flex-wrap">
              <div className="w-full lg:w-6/12 px-4 ml-auto mr-auto text-center">
                <div className="pr-12">
                  <h1 className="text-white font-semibold text-5xl">
                    Megbízható fuvarozási szolgáltatások
                  </h1>
                  <p className="mt-4 text-lg text-blueGray-200">
                    Szikora Transz Kft - professzionális árufuvarozás belföldön
                    és nemzetközileg. Több kamionból és tapasztalt sofőrökből
                    álló flottánkkal mindig a rendelkezésére állunk.
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
                    <h6 className="text-xl font-semibold">
                      Belföldi fuvarozás
                    </h6>
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
                    <h6 className="text-xl font-semibold">
                      Nemzetközi szállítás
                    </h6>
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
                    <h6 className="text-xl font-semibold">
                      Biztosított szállítás
                    </h6>
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

              <div className="w-full md:w-4/12 px-4 mr-auto ml-auto">
                <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded-lg bg-lightBlue-500">
                  <img
                    alt="..."
                    src="https://images.unsplash.com/photo-1602722053028-1c51a1a20620?ixlib=rb-1.2.1&auto=format&fit=crop&w=1050&q=80"
                    className="w-full align-middle rounded-t-lg"
                  />
                  <blockquote className="relative p-8 mb-4">
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

        <section id="about" className="relative py-20">
          <div
            className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-20 h-20"
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
                  src="https://images.unsplash.com/photo-1519181245277-c07eb80a4bea?ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80"
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

        <section id="contact" className="pb-20 relative block bg-blueGray-800">
          <div
            className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-20 h-20"
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
                className="text-blueGray-800 fill-current"
                points="2560 0 2560 100 0 100"
              ></polygon>
            </svg>
          </div>

          <div className="container mx-auto px-4 lg:pt-24 lg:pb-64">
            <div className="flex flex-wrap text-center justify-center">
              <div className="w-full lg:w-6/12 px-4">
                <h2 className="text-4xl font-semibold text-white">
                  Miben vagyunk jók?
                </h2>
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
                <h6 className="text-xl mt-5 font-semibold text-white">
                  Pontosság
                </h6>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Mindig időben érkezünk és teljesítjük ígéreteinket. Határidők
                  betartása nálunk alapvető elv.
                </p>
              </div>
              <div className="w-full lg:w-3/12 px-4 text-center">
                <div className="text-blueGray-800 p-3 w-12 h-12 shadow-lg rounded-full bg-white inline-flex items-center justify-center">
                  <i className="fas fa-euro-sign text-xl"></i>
                </div>
                <h5 className="text-xl mt-5 font-semibold text-white">
                  Versenyképes árak
                </h5>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Áraink a piaci viszonyoknak megfelelőek, miközben nem
                  veszítünk a minőségből.
                </p>
              </div>
              <div className="w-full lg:w-3/12 px-4 text-center">
                <div className="text-blueGray-800 p-3 w-12 h-12 shadow-lg rounded-full bg-white inline-flex items-center justify-center">
                  <i className="fas fa-headset text-xl"></i>
                </div>
                <h5 className="text-xl mt-5 font-semibold text-white">
                  Ügyfélszolgálat
                </h5>
                <p className="mt-2 mb-4 text-blueGray-400">
                  Szakértő csapatunk mindig rendelkezésére áll kérdéseivel,
                  problémáival kapcsolatban.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="relative block py-24 lg:pt-0 bg-blueGray-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center lg:-mt-64 -mt-48">
              <div className="w-full lg:w-6/12 px-4">
                <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-200">
                  <div className="flex-auto p-5 lg:p-10">
                    <h4 className="text-2xl font-semibold">Ajánlatkérés</h4>
                    <p className="leading-relaxed mt-1 mb-4 text-blueGray-500">
                      Töltse ki az alábbi űrlapot és 24 órán belül visszajelzünk
                      részletes ajánlattal.
                    </p>
                    <div className="relative w-full mb-3 mt-8">
                      <label
                        className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
                        htmlFor="full-name"
                      >
                        Teljes név
                      </label>
                      <input
                        type="text"
                        className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
                        placeholder="Teljes név"
                      />
                    </div>

                    <div className="relative w-full mb-3">
                      <label
                        className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
                        htmlFor="email"
                      >
                        Email cím
                      </label>
                      <input
                        type="email"
                        className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
                        placeholder="Email cím"
                      />
                    </div>

                    <div className="relative w-full mb-3">
                      <label
                        className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
                        htmlFor="message"
                      >
                        Üzenet
                      </label>
                      <textarea
                        rows="4"
                        cols="80"
                        className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full"
                        placeholder="Üzenet szövege..."
                      />
                    </div>
                    <div className="text-center mt-6">
                      <button
                        className="bg-blueGray-800 text-white active:bg-blueGray-600 text-sm font-bold uppercase px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                        type="button"
                      >
                        Üzenet küldése
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
