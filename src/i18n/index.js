import { useLocation } from "react-router-dom";
import * as huModule from "./hu.js";
import * as enModule from "./en.js";

function buildDictionary(mod) {
  return {
    landing: mod.landing,
    servicePage: mod.servicePage,
    quoteForm: mod.quoteForm,
    footer: mod.footer,
    adatvedelem: mod.adatvedelem,
    pages: {
      belfoldi: mod.pagesBelfoldi,
      nemzetkozi: mod.pagesNemzetkozi,
      biztositott: mod.pagesBiztositott,
      expressz: mod.pagesExpressz,
      rendezveny: mod.pagesRendezveny,
      egyedi: mod.pagesEgyedi,
    },
  };
}

const DICTIONARIES = {
  hu: buildDictionary(huModule),
  en: buildDictionary(enModule),
};

function resolvePath(dict, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), dict);
}

export function localeFromPathname(pathname) {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "hu";
}

export function useTranslation() {
  const location = useLocation();
  const locale = localeFromPathname(location.pathname);

  const t = (path) => {
    const value = resolvePath(DICTIONARIES[locale], path);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing "${locale}" translation for "${path}", falling back to hu.`);
      }
      const fallback = resolvePath(DICTIONARIES.hu, path);
      return fallback !== undefined ? fallback : path;
    }
    return value;
  };

  return { t, locale };
}

// `path` is always the canonical HU path ("/", "/belfoldi-fuvarozas-arajanlat", ...).
export function localizePath(path, locale) {
  if (locale !== "en") return path;
  return path === "/" ? "/en" : `/en${path}`;
}

export function delocalizePath(pathname) {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}
