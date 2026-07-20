import { useState } from "react";

const STORAGE_KEY = "darkMode";

// R16 (fejlesztési audit, 2026-07-19): a preferencia explicit localStorage-
// kulcsban perzisztálódik, fiókonként/eszközönként — ha még sosem állította
// be senki ezen az eszközön, az OS/böngésző `prefers-color-scheme`-jét
// vesszük alapul induláskor, utána viszont a kézi kapcsoló felülírja és
// onnantól már NEM követi az OS-váltást (explicit döntés, nem automatikus).
function readInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch (e) {
    // localStorage nem elérhető (pl. privát böngészés egyes böngészőkben) — OS-preferenciára esünk vissza
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// Szándékosan NEM a `document.documentElement`-re teszi a `dark` osztályt —
// a nyilvános marketing oldalak (Landing.js és a hozzá tartozó long-tail
// oldalak) saját, fix világos arculatot használnak, azokat ez a funkció nem
// érinti. A hívó (jelenleg: layouts/Admin.js) a SAJÁT gyökér elemére teszi
// fel a visszaadott `isDark`-ból számított osztályt — a Tailwind `dark:`
// variáns bármely ős elem `.dark` osztályától működik, nem csak a
// `<html>`-étől.
export function useDarkMode() {
  const [isDark, setIsDark] = useState(readInitial);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  return [isDark, toggle];
}
