import React, { useEffect } from "react";
import { Switch, Route, Redirect, useHistory } from "react-router-dom";

// components
import Navbar from "components/Navbars/AuthNavbar.js";

// views
import Login from "views/auth/Login.js";
import Register from "views/auth/Register.js";

export default function Auth() {
  const history = useHistory();

  useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(sessionStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    if (user) {
      history.push(user.admin ? "/admin/dashboard" : "/user/dashboard");
    }
  }, [history]);

  return (
    <>
      <Navbar transparent />
      <main>
        <section className="relative min-h-screen w-full bg-ink-900 py-40">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 10%, rgba(47,77,224,0.35), transparent 45%), radial-gradient(circle at 85% 90%, rgba(47,77,224,0.25), transparent 40%)",
            }}
          />
          <div className="grain-overlay" />
          <div className="relative z-10">
            <Switch>
              <Route path="/auth/login" exact component={Login} />
              <Route path="/auth/register" exact component={Register} />
              <Redirect from="/auth" to="/auth/login" />
            </Switch>
          </div>
        </section>
      </main>
    </>
  );
}
