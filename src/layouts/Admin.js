import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import Sidebar from "components/Sidebar/Sidebar.js";
import useNoIndex from "utils/useNoIndex";

// Import views
import Dashboard from "views/admin/Dashboard.js";
import Settings from "views/admin/Settings.js";
import Kamionok from "views/admin/Kamionok.js";
import Potkocsi from "views/admin/Potkocsi.js";
import Karbantartasok from "views/admin/Karbantartasok.js";
import Soforok from "views/admin/Soforok.js";
import Fajlok from "views/admin/Fajlok.js";
import Esemenyek from "views/admin/Esemenyek.js";
import KamionForm from "views/admin/KamionForm.js";
import PotkocsiForm from "views/admin/PotkocsiForm.js";
import SoforForm from "views/admin/SoforForm.js";
import LoginPage from "views/auth/Login.js";
import Bejelentesek from "views/admin/Bejelentesek";
import BejelentesekForm from "views/admin/BejelentesekForm";
import Szabadsagok from "views/admin/Szabadsagok.js";
import Naplo from "views/admin/Naplo.js";
import Koltsegek from "views/admin/Koltsegek.js";
import Flottakovetes from "views/admin/Flottakovetes.js";
import Fuvarok from "views/admin/Fuvarok.js";
import Fuvartervezo from "views/admin/Fuvartervezo.js";
import VezetesiIdo from "views/admin/VezetesiIdo.js";
import Ugyfelek from "views/admin/Ugyfelek.js";
import UgyfelForm from "views/admin/UgyfelForm.js";
import Felhasznalok from "views/admin/Felhasznalok.js";
import UjFelhasznalo from "views/admin/UjFelhasznalo.js";
import Helyszinek from "views/admin/Helyszinek.js";
import HelyszinForm from "views/admin/HelyszinForm.js";
import Jogosultsagok from "views/admin/Jogosultsagok.js";
import Listak from "views/admin/Listak.js";

const PrivateRoute = ({ component: Component, ...rest }) => {
  const isAuthenticated = sessionStorage.getItem("user") !== null;
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect to="/auth/login" />
        )
      }
    />
  );
};

export default function Admin() {
  useNoIndex();
  return (
    <>
      <Sidebar />

      {/* Háttér — fix réteg, nem görgethető, a Sidebar-hoz igazítva */}
      <div className="fixed inset-y-0 right-0 left-0 overflow-hidden bg-slate-50 md:left-72">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% -10%, rgba(47,77,224,0.08), transparent 45%), radial-gradient(circle at 90% 110%, rgba(47,77,224,0.06), transparent 40%)",
          }}
        />
        <div className="grain-overlay" />
      </div>

      {/* Tartalom — fix magasságú, csak ez görgethető, a böngészőoldal maga nem */}
      <div className="fixed inset-y-0 right-0 left-0 overflow-y-auto md:left-72">
        <div className="mx-auto h-full w-full px-4 pt-8 pb-16 md:px-10 md:pb-8">
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
            <PrivateRoute
              path="/admin/karbantartasok"
              exact
              component={Karbantartasok}
            />
            <PrivateRoute path="/admin/soforok" exact component={Soforok} />
            <PrivateRoute
              path="/admin/vezetesi-ido"
              exact
              component={VezetesiIdo}
            />
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
            <PrivateRoute path="/admin/fuvarok" exact component={Fuvarok} />
            <PrivateRoute
              path="/admin/fuvartervezo"
              exact
              component={Fuvartervezo}
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
            <Route path="/auth/login" exact component={LoginPage} />
            <Redirect from="/admin" to="/admin/dashboard" />
          </Switch>
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
    </>
  );
}
