import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import "assets/styles/tailwind.css";

// views without layouts
import NotFound from "views/NotFound.js";

import ToastContainer from "components/UI/ToastContainer.js";
import ConfirmDialogContainer from "components/UI/ConfirmDialogContainer.js";
import ScrollToTop from "components/UI/ScrollToTop.js";
import UpdateBanner from "components/PWA/UpdateBanner.js";
import { notifySwUpdate } from "utils/swUpdate";

// layouts — lazy-betöltve: az admin/user/auth modulok kódja csak akkor
// tölt le, ha a látogató ténylegesen ezekre az útvonalakra navigál. Így az
// anonim főoldal-látogató nem húzza be a teljes flottakezelő app kódját is.
const Admin = lazy(() => import("layouts/Admin.js"));
const User = lazy(() => import("layouts/User.js"));
const Auth = lazy(() => import("layouts/Auth.js"));
const Profile = lazy(() => import("views/Profile.js"));

// A marketing/landing oldalak (főoldal + 6 long-tail szolgáltatás-oldal +
// adatvédelem) route-onként lazy-betöltve — korábban mind a 7 (a NotFound-dal
// együtt 8) statikusan be volt húzva a fő JS-bundle-be, tehát egyetlen oldal
// betöltése is letöltötte és futtatta mind a többi kódját, feleslegesen
// növelve az LCP-t domináló hidratálási/parse-időt (SEO-audit: 89-102 KiB
// kihasználatlan JS minden egyes marketing oldalon). Ugyanaz a minta, mint
// amit az Admin/User/Auth layoutok fent már használnak. A `scripts/
// prerender.js` `networkidle` várakozása (+ 1s ráadás) a lazy chunk
// letöltését/renderelését is bevárja, tehát ez a crawlereknek kiszolgált
// statikus HTML-t nem érinti.
const Landing = lazy(() => import("views/Landing.js"));
const BelfoldiFuvarozas = lazy(() => import("views/landing/BelfoldiFuvarozas.js"));
const NemzetkoziFuvarozas = lazy(() => import("views/landing/NemzetkoziFuvarozas.js"));
const BiztositottSzallitas = lazy(() => import("views/landing/BiztositottSzallitas.js"));
const ExpresszFuvarozas = lazy(() => import("views/landing/ExpresszFuvarozas.js"));
const RendezvenySzallitas = lazy(() => import("views/landing/RendezvenySzallitas.js"));
const EgyediArajanlat = lazy(() => import("views/landing/EgyediArajanlat.js"));
const Adatvedelem = lazy(() => import("views/Adatvedelem.js"));

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
      <ScrollToTop />
      <Switch>
        {/* add routes with layouts */}
        <Route path="/admin" component={Admin} />
        <Route path="/user" component={User} />
        <Route path="/auth" component={Auth} />
        {/* add routes without layouts */}
        <Route path="/profile" exact component={Profile} />
        {/* szolgáltatás-specifikus long-tail SEO oldalak — ld.
            src/views/landing/*.js és src/components/Landing/ServicePage.js.
            Ugyanide kell felvenni őket a scripts/prerender.js
            ROUTES_TO_PRERENDER listájába és a public/sitemap.xml-be is. */}
        <Route
          path="/belfoldi-fuvarozas-arajanlat"
          exact
          component={BelfoldiFuvarozas}
        />
        <Route
          path="/nemzetkozi-fuvarozas-vamugyintezessel"
          exact
          component={NemzetkoziFuvarozas}
        />
        <Route path="/biztositott-szallitas" exact component={BiztositottSzallitas} />
        <Route path="/expressz-fuvarozas" exact component={ExpresszFuvarozas} />
        <Route path="/rendezveny-szallitas" exact component={RendezvenySzallitas} />
        <Route
          path="/egyedi-arajanlat-fuvarozas"
          exact
          component={EgyediArajanlat}
        />
        <Route path="/adatvedelem" exact component={Adatvedelem} />
        {/* Angol tükör-route-ok — ugyanazok a komponensek, a nyelvet
            rendereléskor `useTranslation()` dönti el az URL-ből (ld.
            src/i18n/index.js). Ld. docs/superpowers/specs/2026-07-27-en-
            landing-translation-design.md a lapos-fájlos prerender/.htaccess
            gotcha miatt, amiért ezek NEM egy `en/` alkönyvtárként
            prerenderelődnek. */}
        <Route
          path="/en/belfoldi-fuvarozas-arajanlat"
          exact
          component={BelfoldiFuvarozas}
        />
        <Route
          path="/en/nemzetkozi-fuvarozas-vamugyintezessel"
          exact
          component={NemzetkoziFuvarozas}
        />
        <Route path="/en/biztositott-szallitas" exact component={BiztositottSzallitas} />
        <Route path="/en/expressz-fuvarozas" exact component={ExpresszFuvarozas} />
        <Route path="/en/rendezveny-szallitas" exact component={RendezvenySzallitas} />
        <Route
          path="/en/egyedi-arajanlat-fuvarozas"
          exact
          component={EgyediArajanlat}
        />
        <Route path="/en/adatvedelem" exact component={Adatvedelem} />
        <Route path="/en" exact component={Landing} />
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
      <ConfirmDialogContainer />
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
