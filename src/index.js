import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import "assets/styles/tailwind.css";

// views without layouts
import Landing from "views/Landing.js";
import NotFound from "views/NotFound.js";

import ToastContainer from "components/UI/ToastContainer.js";
import UpdateBanner from "components/PWA/UpdateBanner.js";
import { notifySwUpdate } from "utils/swUpdate";

// layouts — lazy-betöltve: az admin/user/auth modulok kódja csak akkor
// tölt le, ha a látogató ténylegesen ezekre az útvonalakra navigál. Így az
// anonim főoldal-látogató nem húzza be a teljes flottakezelő app kódját is.
const Admin = lazy(() => import("layouts/Admin.js"));
const User = lazy(() => import("layouts/User.js"));
const Auth = lazy(() => import("layouts/Auth.js"));
const Profile = lazy(() => import("views/Profile.js"));

// `onUpdate` nélkül a service worker új verziója csendben "waiting"
// állapotban ragad, amíg minden fület be nem zárnak — emiatt tűnt úgy,
// hogy a friss deploy után az emberek a régi, cache-elt oldalt látják.
// Az <UpdateBanner /> jelzi ezt egy "Frissítés" gombbal.
serviceWorkerRegistration.register({
  onUpdate: (registration) => notifySwUpdate(registration),
});

const app = (
  <BrowserRouter>
    <Suspense fallback={null}>
      <Switch>
        {/* add routes with layouts */}
        <Route path="/admin" component={Admin} />
        <Route path="/user" component={User} />
        <Route path="/auth" component={Auth} />
        {/* add routes without layouts */}
        <Route path="/profile" exact component={Profile} />
        <Route path="/" exact component={Landing} />
        {/* a /landing a főoldal korábbi, tartalmilag azonos duplikátuma volt
            — most a főoldalra irányít, hogy ne ossza meg a rangsorolási
            jelzéseket két URL között */}
        <Redirect from="/landing" to="/" />
        {/* minden más, ismeretlen útvonal valódi "nem található" nézetet
            kap (noindex-szel), a korábbi csendes "* → /" redirect helyett,
            ami minden törött linket 200-as válasszal a főoldalra vitt */}
        <Route component={NotFound} />
      </Switch>
      <ToastContainer />
      <UpdateBanner />
    </Suspense>
  </BrowserRouter>
);

const rootElement = document.getElementById("root");
// Megjegyzés a scripts/prerender.js-hez (előrenderelt build/index.html): ez
// a projekt mindenhol a régi `ReactDOM.render`-t használja (React 18 mellett
// is) — a `ReactDOM.hydrate` ezzel a legacy render-móddal kombinálva
// hidratálási ütközés esetén duplikált DOM-ot eredményezett tesztelés
// közben. Ezért itt szándékosan MINDIG teljes kliensoldali render fut, még
// előre renderelt HTML felett is: a látogató ezt egy villanásnyi, észrevehetetlen
// újrarajzolásként éli meg, cserébe nincs hidratálási hiba. A crawlerek
// (amiknek ez a lépés valójában szól) ettől függetlenül a nyers, előre
// renderelt HTML-t látják — ők sose futtatják le ezt a kódot.
ReactDOM.render(app, rootElement);
