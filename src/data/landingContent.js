import {
  PiTruckLight,
  PiGlobeLight,
  PiShieldCheckLight,
  PiLightningLight,
  PiFileTextLight,
  PiConfettiLight,
} from "react-icons/pi";

// Megosztott tartalom a Landing.js főoldal és a szolgáltatás-specifikus
// long-tail SEO oldalak (src/views/landing/*.js) között. A tényleges
// szövegek (title/desc/quote/role/company/q/a) a src/i18n/{hu,en}.js
// szótárakban élnek, id alapján kulcsolva — ez a fájl csak a nyelv-független
// szerkezetet (id, ikon, href) tárolja. Ld.
// docs/superpowers/specs/2026-07-27-en-landing-translation-design.md.
export const FEATURES = [
  { id: "domestic", icon: PiTruckLight, href: "/belfoldi-fuvarozas-arajanlat" },
  {
    id: "international",
    icon: PiGlobeLight,
    href: "/nemzetkozi-fuvarozas-vamugyintezessel",
  },
  { id: "insured", icon: PiShieldCheckLight, href: "/biztositott-szallitas" },
  { id: "express", icon: PiLightningLight, href: "/expressz-fuvarozas" },
  { id: "event", icon: PiConfettiLight, href: "/rendezveny-szallitas" },
  { id: "custom", icon: PiFileTextLight, href: "/egyedi-arajanlat-fuvarozas" },
];

export const PROCESS_STEPS = [
  { id: "order", n: "01" },
  { id: "planning", n: "02" },
  { id: "shipping", n: "03" },
  { id: "delivery", n: "04" },
];

export const TESTIMONIALS = [
  { id: "nagy_peter", name: "Nagy Péter" },
  { id: "toth_andrea", name: "Tóth Andrea" },
  { id: "kovacs_gabor", name: "Kovács Gábor" },
  { id: "szabo_katalin", name: "Szabó Katalin" },
  { id: "farkas_zoltan", name: "Farkas Zoltán" },
  { id: "molnar_eszter", name: "Molnár Eszter" },
];

export const FAQ_ITEMS = [
  { id: "response_time" },
  { id: "pricing_factors" },
  { id: "vehicles" },
  { id: "insurance" },
  { id: "damage" },
  { id: "international" },
  { id: "custom_quote" },
  { id: "payment_terms" },
  { id: "driver_application" },
];

// `t` az aktuális nyelv `t()` függvénye (useTranslation()-ből). `selectors`
// elemei vagy egy sima FAQ id string (alap kérdés/válasz a szótárból), vagy
// egy `{ id, aKey }` alakú override, ahol `aKey` egy másik szótár-útvonalra
// mutat egy oldal-specifikus válaszhoz (pl.
// "pages.nemzetkozi.faqOverrides.insurance.a").
export function pickFaq(t, ...selectors) {
  return selectors
    .map((sel) => {
      const isOverride = typeof sel === "object" && sel !== null;
      const id = isOverride ? sel.id : sel;
      const base = FAQ_ITEMS.find((item) => item.id === id);
      if (!base) return null;
      return {
        q: t(`landing.faqItems.${id}.q`),
        a: isOverride && sel.aKey ? t(sel.aKey) : t(`landing.faqItems.${id}.a`),
      };
    })
    .filter(Boolean);
}

export const SERVICE_PAGES = [
  { id: "domestic", path: "/belfoldi-fuvarozas-arajanlat" },
  { id: "international", path: "/nemzetkozi-fuvarozas-vamugyintezessel" },
  { id: "insured", path: "/biztositott-szallitas" },
  { id: "express", path: "/expressz-fuvarozas" },
  { id: "event", path: "/rendezveny-szallitas" },
  { id: "custom", path: "/egyedi-arajanlat-fuvarozas" },
];
