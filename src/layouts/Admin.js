import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import Sidebar from "components/Sidebar/Sidebar.js";
import FooterAdmin from "components/Footers/FooterAdmin.js";

// Import views
import Dashboard from "views/admin/Dashboard.js";
import Settings from "views/admin/Settings.js";
import Kamionok from "views/admin/Kamionok.js";
import Potkocsi from "views/admin/Potkocsi.js";
import Soforok from "views/admin/Soforok.js";
import Fajlok from "views/admin/Fajlok.js";
import Esemenyek from "views/admin/Esemenyek.js";
import KamionForm from "views/admin/KamionForm.js";
import PotkocsiForm from "views/admin/PotkocsiForm.js";
import SoforForm from "views/admin/SoforForm.js";
import LoginPage from "views/auth/Login.js";
import Bejelentesek from "views/admin/Bejelentesek";
import BejelentesekForm from "views/admin/BejelentesekForm";

const PrivateRoute = ({ component: Component, ...rest }) => {
  const isAuthenticated = sessionStorage.getItem("user") !== null;
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  );
};

export default function Admin() {
  return (
    <>
      <Sidebar />
      <div className="relative md:ml-64 bg-gray-50 min-h-screen">
        {/* Main Content */}
        <div className="px-4 md:px-8 mx-auto w-full py-6">
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
            <Route path="/login" exact component={LoginPage} />
            <Redirect from="/admin" to="/admin/dashboard" />
          </Switch>
        </div>
      </div>
    </>
  );
}
