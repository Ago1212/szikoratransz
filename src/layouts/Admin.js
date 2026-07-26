import React, { Suspense, lazy } from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import Sidebar from "components/Sidebar/Sidebar.js";
import Spinner from "components/UI/Spinner.js";
import useNoIndex from "utils/useNoIndex";
import { useDarkMode } from "utils/useDarkMode.js";

// R32 (fejlesztési audit, 2026-07-19): korábban minden admin-nézet (itt kb.
// 30 fájl) egyetlen kezdeti JS-kötegbe került, pedig egy admin egyszerre
// csak egyet néz belőlük — `React.lazy` route-onként külön chunk-ba teszi
// őket, a Suspense-fallback csak az első betöltésnél/route-váltásnál
// villan fel röviden (utána a böngésző cache-eli a chunk-ot).
const Dashboard = lazy(() => import("views/admin/Dashboard.js"));
const Settings = lazy(() => import("views/admin/Settings.js"));
const Kamionok = lazy(() => import("views/admin/Kamionok.js"));
const Potkocsi = lazy(() => import("views/admin/Potkocsi.js"));
const Furgonok = lazy(() => import("views/admin/Furgonok.js"));
const Karbantartasok = lazy(() => import("views/admin/Karbantartasok.js"));
const Soforok = lazy(() => import("views/admin/Soforok.js"));
const Fajlok = lazy(() => import("views/admin/Fajlok.js"));
const Esemenyek = lazy(() => import("views/admin/Esemenyek.js"));
const KamionForm = lazy(() => import("views/admin/KamionForm.js"));
const PotkocsiForm = lazy(() => import("views/admin/PotkocsiForm.js"));
const FurgonForm = lazy(() => import("views/admin/FurgonForm.js"));
const SoforForm = lazy(() => import("views/admin/SoforForm.js"));
const LoginPage = lazy(() => import("views/auth/Login.js"));
const Bejelentesek = lazy(() => import("views/admin/Bejelentesek"));
const BejelentesekForm = lazy(() => import("views/admin/BejelentesekForm"));
const Szabadsagok = lazy(() => import("views/admin/Szabadsagok.js"));
const Naplo = lazy(() => import("views/admin/Naplo.js"));
const Koltsegek = lazy(() => import("views/admin/Koltsegek.js"));
const Flottakovetes = lazy(() => import("views/admin/Flottakovetes.js"));
const Ugyfelek = lazy(() => import("views/admin/Ugyfelek.js"));
const UgyfelForm = lazy(() => import("views/admin/UgyfelForm.js"));
const Felhasznalok = lazy(() => import("views/admin/Felhasznalok.js"));
const UjFelhasznalo = lazy(() => import("views/admin/UjFelhasznalo.js"));
const Helyszinek = lazy(() => import("views/admin/Helyszinek.js"));
const HelyszinForm = lazy(() => import("views/admin/HelyszinForm.js"));
const Jogosultsagok = lazy(() => import("views/admin/Jogosultsagok.js"));
const Listak = lazy(() => import("views/admin/Listak.js"));
const Devizak = lazy(() => import("views/admin/Devizak.js"));
const Ajanlatkeresek = lazy(() => import("views/admin/Ajanlatkeresek.js"));
const SoforScorecard = lazy(() => import("views/admin/SoforScorecard.js"));
const ErtesitesiElozmenyek = lazy(() => import("views/admin/ErtesitesiElozmenyek.js"));
const Tachograf = lazy(() => import("views/admin/Tachograf.js"));
const BeerkezettDokumentumok = lazy(() =>
  import("views/admin/BeerkezettDokumentumok.js"),
);
const Fuvarok = lazy(() => import("views/admin/Fuvarok.js"));
const FuvarForm = lazy(() => import("views/admin/FuvarForm.js"));
const FuvarStatisztika = lazy(() => import("views/admin/FuvarStatisztika.js"));

// A backend a session-típus alapján (admin vs sofőr) elutasítja a nem
// megfelelő akciókat, de a frontend guard korábban csak bejelentkezettséget
// nézett, szerepkört nem — egy bejelentkezett sofőr böngészőbe írva egy
// /admin/... URL-t átjutott ezen, és egy törött/üres admin felületet látott
// (ld. biztonsági audit). Ez a második védelmi vonal: `is_admin` nélkül a
// sofőr a saját (működő) /user/dashboard-jára kerül, nem az admin felületre.
const PrivateRoute = ({ component: Component, ...rest }) => {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }
  const isAuthenticated = !!user;
  const isAdmin = !!user?.is_admin;
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated && isAdmin ? (
          <Component {...props} />
        ) : (
          <Redirect to={isAuthenticated ? "/user/dashboard" : "/auth/login"} />
        )
      }
    />
  );
};

export default function Admin() {
  useNoIndex();
  // R16 (fejlesztési audit, 2026-07-19): a `dark` osztály SZÁNDÉKOSAN nem a
  // `<html>`-re kerül, hanem erre a wrapperre — a nyilvános marketing
  // oldalak (Landing.js és társai) saját, fix világos arculatát ez nem
  // érinti, csak az admin app-fát.
  const [isDark, toggleDark] = useDarkMode();
  return (
    // `colorScheme` explicit beállítása KRITIKUS itt — enélkül a böngésző
    // az OS saját sötét/világos preferenciáját használja bizonyos natív
    // form-vezérlő belső rétegekhez (pl. input/select háttere) FÜGGETLENÜL
    // a szerzői CSS `background-color`-tól, ami élőben ellenőrizve
    // ténylegesen fehér input-mezőket eredményezett egy egyébként helyesen
    // sötét `dark:bg-ink-800` osztály mellett is (a getComputedStyle a
    // helyes sötét színt adta vissza, mégis fehéren festődött ki — ez a
    // dokumentált Chromium-viselkedés az oka, nem CSS-specificitási hiba).
    <div className={isDark ? "dark" : ""} style={{ colorScheme: isDark ? "dark" : "light" }}>
      {/* UX-audit — nincs skip-link a teljes admin felületen, a desktop
          sidebar 15-20+ fókuszálható eleme miatt egy billentyűzettel
          navigáló felhasználó minden oldalbetöltésnél végig kénytelen
          Tab-elni ezen, mielőtt a tartalomhoz érne (WCAG 2.4.1). Vizuálisan
          rejtett, csak fókuszra jelenik meg. */}
      <a
        href="#admin-tartalom"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Ugrás a tartalomra
      </a>
      <Sidebar isDark={isDark} onToggleDark={toggleDark} />

      {/* Háttér — fix réteg, nem görgethető, a Sidebar-hoz igazítva */}
      <div className="fixed inset-y-0 right-0 left-0 overflow-hidden bg-slate-50 dark:bg-ink-950 md:left-64">
        <div
          className="absolute inset-0 opacity-60 dark:opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% -10%, rgba(47,77,224,0.08), transparent 45%), radial-gradient(circle at 90% 110%, rgba(47,77,224,0.06), transparent 40%)",
          }}
        />
        <div className="grain-overlay" />
      </div>

      {/* Tartalom — fix magasságú, csak ez görgethető, a böngészőoldal maga nem */}
      <div id="admin-tartalom" className="fixed inset-y-0 right-0 left-0 overflow-y-auto md:left-64">
        <div className="mx-auto h-full w-full px-4 pt-8 pb-16 md:px-10 md:pb-8">
          <Suspense fallback={<Spinner />}>
          <Switch>
            <PrivateRoute path="/admin/dashboard" exact component={Dashboard} />
            <PrivateRoute path="/admin/settings" exact component={Settings} />
            <PrivateRoute path="/admin/kamionok" exact component={Kamionok} />
            <PrivateRoute
              path="/admin/kamionForm"
              exact
              component={KamionForm}
            />
            <PrivateRoute path="/admin/potkocsi" exact component={Potkocsi} />
            <PrivateRoute
              path="/admin/potkocsiForm"
              exact
              component={PotkocsiForm}
            />
            <PrivateRoute path="/admin/furgonok" exact component={Furgonok} />
            <PrivateRoute
              path="/admin/furgonForm"
              exact
              component={FurgonForm}
            />
            <PrivateRoute
              path="/admin/karbantartasok"
              exact
              component={Karbantartasok}
            />
            <PrivateRoute path="/admin/soforok" exact component={Soforok} />
            <PrivateRoute path="/admin/soforForm" exact component={SoforForm} />
            <PrivateRoute path="/admin/fajlok" exact component={Fajlok} />
            <PrivateRoute path="/admin/esemenyek" exact component={Esemenyek} />
            <PrivateRoute
              path="/admin/bejelentesek"
              exact
              component={Bejelentesek}
            />
            <PrivateRoute
              path="/admin/bejelentesForm"
              exact
              component={BejelentesekForm}
            />
            <PrivateRoute
              path="/admin/szabadsagok"
              exact
              component={Szabadsagok}
            />
            <PrivateRoute path="/admin/naplo" exact component={Naplo} />
            <PrivateRoute path="/admin/koltsegek" exact component={Koltsegek} />
            <PrivateRoute
              path="/admin/flottakovetes"
              exact
              component={Flottakovetes}
            />
            <PrivateRoute path="/admin/ugyfelek" exact component={Ugyfelek} />
            <PrivateRoute
              path="/admin/ugyfelForm"
              exact
              component={UgyfelForm}
            />
            <PrivateRoute
              path="/admin/felhasznalok"
              exact
              component={Felhasznalok}
            />
            <PrivateRoute
              path="/admin/felhasznalok/uj"
              exact
              component={UjFelhasznalo}
            />
            <PrivateRoute
              path="/admin/jogosultsagok"
              exact
              component={Jogosultsagok}
            />
            <PrivateRoute path="/admin/listak" exact component={Listak} />
            <PrivateRoute path="/admin/devizak" exact component={Devizak} />
            <PrivateRoute
              path="/admin/ajanlatkeresek"
              exact
              component={Ajanlatkeresek}
            />
            <PrivateRoute
              path="/admin/sofor-riport"
              exact
              component={SoforScorecard}
            />
            <PrivateRoute path="/admin/tachograf" exact component={Tachograf} />
            <PrivateRoute
              path="/admin/ertesitesi-elozmenyek"
              exact
              component={ErtesitesiElozmenyek}
            />
            <PrivateRoute
              path="/admin/helyszinek"
              exact
              component={Helyszinek}
            />
            <PrivateRoute
              path="/admin/helyszinForm"
              exact
              component={HelyszinForm}
            />
            <PrivateRoute
              path="/admin/beerkezettDokumentumok"
              exact
              component={BeerkezettDokumentumok}
            />
            <PrivateRoute path="/admin/fuvarok" exact component={Fuvarok} />
            <PrivateRoute
              path="/admin/fuvarForm"
              exact
              component={FuvarForm}
            />
            <PrivateRoute
              path="/admin/fuvarStatisztika"
              exact
              component={FuvarStatisztika}
            />
            <Route path="/auth/login" exact component={LoginPage} />
            <Redirect from="/admin" to="/admin/dashboard" />
          </Switch>
          </Suspense>
          {/* Garantált térköz a mobil alsó navigáció alatt — valódi blokk-magasság,
              nem padding/margin, mert azt a böngésző figyelmen kívül hagyja a
              görgethető terület számításánál, ha a tartalom egy `h-full`
              (border-box) ősnél magasabbra nő. Enélkül hosszabb formoknál
              (pl. KamionForm) a mentés gomb a navsáv mögé csúszhat. */}
          <div
            className="h-20 w-full flex-shrink-0 md:hidden"
            style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
