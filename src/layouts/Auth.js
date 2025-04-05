import React, { useEffect } from "react";
import { Switch, Route, Redirect, useHistory } from "react-router-dom";

// components
import Navbar from "components/Navbars/AuthNavbar.js";
import FooterSmall from "components/Footers/FooterSmall.js";

// views
import Login from "views/auth/Login.js";
import Register from "views/auth/Register.js";

export default function Auth() {
  const history = useHistory(); // Használj useHistory-t

  // Ellenőrizd a bejelentkezett állapotot
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("user") !== null;
    if (isAuthenticated) {
      history.push("/admin/dashboard"); // Navigálj a dashboard oldalra
    }
  }, [history]);

  return (
    <>
      <Navbar transparent />
      <main>
        <section className="relative w-full h-full py-40 min-h-screen">
          <div
            className="absolute top-0 w-full h-full bg-blueGray-800 bg-no-repeat bg-full"
            style={{
              backgroundImage:
                "url(" + require("assets/img/register_bg_2.png").default + ")",
            }}
          ></div>
          <Switch>
            <Route path="/auth/login" exact component={Login} />
            <Route path="/auth/register" exact component={Register} />
            <Redirect from="/auth" to="/auth/login" />
          </Switch>
        </section>
      </main>
    </>
  );
}
