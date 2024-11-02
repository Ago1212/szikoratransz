import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";

// components

import AdminNavbar from "components/Navbars/AdminNavbar.js";
import Sidebar from "components/Sidebar/Sidebar.js";
import FooterAdmin from "components/Footers/FooterAdmin.js";

// views

import Dashboard from "views/admin/Dashboard.js";
import Settings from "views/admin/Settings.js";


import Kamionok from "views/admin/Kamionok.js";
import Potkocsi from "views/admin/Potkocsi.js";
import Soforok from "views/admin/Soforok.js";
import Fajlok from "views/admin/Fajlok.js";

import KamionForm from "views/admin/KamionForm.js";
import PotkocsiForm from "views/admin/PotkocsiForm.js";
import SoforForm from "views/admin/SoforForm.js";

export default function Admin() {
  return (
    <>
      <Sidebar />
      <div className="relative md:ml-64">
        <AdminNavbar />
        <div className="px-4 md:px-10 mx-auto w-full -m-24">
          <Switch>
            <Route path="/admin/dashboard" exact component={Dashboard} />
            <Route path="/admin/settings" exact component={Settings} />
            <Route path="/admin/kamionok" exact component={Kamionok} />
            <Route path="/admin/kamionForm" exact component={KamionForm} />
            <Route path="/admin/potkocsi" exact component={Potkocsi} />
            <Route path="/admin/potkocsiForm" exact component={PotkocsiForm} />
            <Route path="/admin/soforok" exact component={Soforok} />
            <Route path="/admin/soforForm" exact component={SoforForm} />
            <Route path="/admin/fajlok" exact component={Fajlok} />
            <Redirect from="/admin" to="/admin/dashboard" />
          </Switch>
        </div>
      </div>
    </>
  );
}
