import React from "react";
import { Link } from "react-router-dom";
import {
  PiEnvelopeLight,
  PiPhoneLight,
  PiMapPinLight,
  PiIdentificationCardLight,
} from "react-icons/pi";
import { SERVICE_PAGES } from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";

// Korábban egy generikus Maps *keresés* URL volt itt (SEO-audit: nem egy
// konkrét, ellenőrzött hely-linkre mutatott). Ez a cég valódi Google Business
// Profile bejegyzésének stabil, cid-alapú linkje — a felhasználó által
// megosztott https://maps.app.goo.gl/... rövid link feloldásából nyert
// koordináták (~190m eltérés a schema.org LocalBusiness geo mezőjéhez képest,
// ami pin-elhelyezési pontosságkülönbség, nem eltérő hely) és a `data=`
// paraméterben szereplő hex azonosító (0x4bc9fef3782d8c54 → decimális cid)
// alapján megerősítve, hogy ugyanarra a cégre mutat.
const MAPS_LINK = "https://maps.google.com/?cid=5461176344810196052";

export default function Footer() {
  const { t, locale } = useTranslation();
  return (
    <footer className="bg-[#2E3239] text-white pt-4">
      {/* Útvonal-motívum: vékony szaggatott elválasztó, mint a fenti szekciókban */}
      <div className="border-t-2 border-dashed border-[#2F4DE0]/30"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* 1 — Bemutatkozás */}
          <div>
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              width="1600"
              height="578"
              className="h-8 w-auto mb-4"
            />
            <p className="text-sm text-white/60 leading-relaxed mb-5">{t("footer.description")}</p>
            <ul className="space-y-2 text-xs text-white/50 font-[Overpass_Mono] uppercase tracking-wide">
              {t("footer.bullets").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* 2 — Szolgáltatásaink (site-szintű belső link minden long-tail oldalra) */}
          <div>
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.servicesHeading")}
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {SERVICE_PAGES.map((s) => (
                <li key={s.path}>
                  <Link
                    to={localizePath(s.path, locale)}
                    className="hover:text-white transition-colors duration-300"
                  >
                    {t(`landing.servicePages.${s.id}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3 — Cég / fontos oldalak */}
          <div>
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.companyHeading")}
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>
                <Link
                  to={localizePath("/", locale)}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.home")}
                </Link>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#about`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.about")}
                </a>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#gyik`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.faq")}
                </a>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#contact`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.driverApplication")}
                </a>
              </li>
              <li>
                <Link
                  to="/auth/login"
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.login")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizePath("/adatvedelem", locale)}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.privacy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* 4 — Kapcsolat + CTA */}
          <div>
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.contactHeading")}
            </span>
            <ul className="mt-4 space-y-4 text-sm text-white/70">
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiEnvelopeLight className="text-white/60" />
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
                  <PiPhoneLight className="text-white/60" />
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
                  <PiMapPinLight className="text-white/60" />
                </span>
                <a
                  href={MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/25 hover:decoration-white/70 hover:text-white transition-colors duration-300"
                >
                  2518 Leányvár, Bécsi út 86
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiIdentificationCardLight className="text-white/60" />
                </span>
                <span>{t("footer.taxIdLabel")} 26381626-2-11</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/30 font-[Overpass_Mono] uppercase tracking-wide">
          <span>
            © {new Date().getFullYear()} Szikora Transz Kft. · {t("footer.taxIdLabel")} 26381626-2-11
          </span>
          <span className="flex items-center gap-4">
            <Link
              to={localizePath("/adatvedelem", locale)}
              className="hover:text-white/60 transition-colors duration-300"
            >
              {t("footer.privacyLink")}
            </Link>
            <span>{t("footer.allRightsReserved")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
