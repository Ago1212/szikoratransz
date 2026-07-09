import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "assets/styles/tailwind.css";

// layouts

import Admin from "layouts/Admin.js";
import User from "layouts/User.js";
import Auth from "layouts/Auth.js";

// views without layouts

import Landing from "views/Landing.js";
import Profile from "views/Profile.js";

import ToastContainer from "components/UI/ToastContainer.js";
import UpdateBanner from "components/PWA/UpdateBanner.js";
import { notifySwUpdate } from "utils/swUpdate";

// `onUpdate` nélkül a service worker új verziója csendben "waiting"
// állapotban ragad, amíg minden fület be nem zárnak — emiatt tűnt úgy,
// hogy a friss deploy után az emberek a régi, cache-elt oldalt látják.
// Az <UpdateBanner /> jelzi ezt egy "Frissítés" gombbal.
serviceWorkerRegistration.register({
  onUpdate: (registration) => notifySwUpdate(registration),
});

ReactDOM.render(
  <BrowserRouter>
    <Switch>
      {/* add routes with layouts */}
      <Route path="/admin" component={Admin} />
      <Route path="/user" component={User} />
      <Route path="/auth" component={Auth} />
      {/* add routes without layouts */}
      <Route path="/landing" exact component={Landing} />
      <Route path="/profile" exact component={Profile} />
      <Route path="/" exact component={Landing} />
      {/* add redirect for first page */}
      <Redirect from="*" to="/" />
    </Switch>
    <ToastContainer />
    <UpdateBanner />
  </BrowserRouter>,
  document.getElementById("root"),
);
