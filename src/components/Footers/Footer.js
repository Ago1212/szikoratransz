import React from "react";
import { PiEnvelopeLight, PiPhoneLight, PiMapPinLight } from "react-icons/pi";

export default function Footer() {
  return (
    <footer className="bg-[#23262B] text-white pt-4">
      {/* Útvonal-motívum: vékony szaggatott elválasztó, mint a fenti szekciókban */}
      <div className="border-t-2 border-dashed border-[#2F4DE0]/30"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
          {/* Kapcsolat */}
          <div className="lg:w-1/2 w-full">
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              Kapcsolat
            </span>
            <h2 className="font-[Overpass] font-extrabold text-2xl text-white mt-2 mb-6">
              Vedd fel velünk a kapcsolatot!
            </h2>

            <ul className="space-y-4 text-base text-white/70">
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiEnvelopeLight className="text-[#2F4DE0]" />
                </span>
                <a
                  href="mailto:szikoratransz@gmail.com"
                  className="underline decoration-white/25 hover:decoration-white/70 hover:text-white transition-colors duration-300"
                >
                  szikoratransz@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiPhoneLight className="text-[#2F4DE0]" />
                </span>
                <span>
                  <a
                    href="tel:+36308115776"
                    className="underline decoration-white/25 hover:decoration-white/70 hover:text-white transition-colors duration-300"
                  >
                    +36 30 811 5776
                  </a>
                  {" / "}
                  <a
                    href="tel:+36202433368"
                    className="underline decoration-white/25 hover:decoration-white/70 hover:text-white transition-colors duration-300"
                  >
                    +36 20 243 3368
                  </a>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiMapPinLight className="text-[#2F4DE0]" />
                </span>
                2518 Leányvár, Bécsi út 86
              </li>
            </ul>
          </div>

          {/* Térkép */}
          <div className="lg:w-1/2 w-full">
            <div className="rounded-xl overflow-hidden border border-white/10 h-64 w-full">
              <iframe
                title="Térkép"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2685.962275700994!2d18.770399076915425!3d47.6851525825491!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4c8579a71faf6655%3A0x4bc9fef3782d8c54!2sSzikora%20Transz%20Kft!5e0!3m2!1shu!2hu!4v1747153064329!5m2!1shu!2hu"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/30 font-[Overpass_Mono] uppercase tracking-wide">
          <span>© {new Date().getFullYear()} Szikora Transz Kft.</span>
          <span>Minden jog fenntartva.</span>
        </div>
      </div>
    </footer>
  );
}
