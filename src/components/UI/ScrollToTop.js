import { useLayoutEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";

// React Router v5 nem görget fel automatikusan route-váltáskor (ez csak
// hagyományos, teljes oldalbetöltésnél történik meg magától) — enélkül pl. a
// Landing.js aljáról egy long-tail szolgáltatás-oldalra kattintva az az
// oldal is a Landing korábbi görgetési pozíciójában nyílik meg.
//
// Korábban itt egy ~180ms-es, a görgetési távolságtól függő scroll-animáció
// futott — kiderült, hogy ez pont a hosszú Landing oldalról egy rövidebb
// aloldalra (pl. "Nemzetközi szállítás") navigálva zavaró: az animáció alatt
// az új oldal középső/alsó szakaszai (referenciák, GYIK) villantak fel egy
// pillanatra, mielőtt a görgetés elérte a tetejét — mintha nem is történt
// volna valódi navigáció. Ezért itt most azonnal (animáció nélkül) a tetejére
// ugrunk `useLayoutEffect`-tel (a böngésző kifestése előtt fut, így a
// felhasználó sosem látja az új oldalt a régi görgetési pozícióban) — a "minimális
// animáció" igényt a ServicePage saját, tartalom-beúszó (fade+slide) belépő
// animációja adja, nem a window scroll-pozíciója (ld. ServicePage.js).
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const history = useHistory();

  useLayoutEffect(() => {
    // Vissza/előre gombnál (`POP`) a böngésző saját scroll-visszaállítása
    // fut (a felhasználó korábbi pozíciójára ugrik vissza) — ha itt is
    // felülírnánk, a két mechanizmus versenyre kelne. Csak előre-navigációnál
    // (`PUSH`/`REPLACE`, pl. egy Link-kattintásnál) ugrunk a tetejére.
    if (history.action === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, history.action]);

  return null;
}
