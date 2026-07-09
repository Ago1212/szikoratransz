import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import UserDashboard from "views/user/Dashboard.js";
import useNoIndex from "utils/useNoIndex";

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

export default function User() {
  useNoIndex();
  return (
    <>
      <div className="relative min-h-screen bg-sand-50">
        {/* Main Content */}
        <div className="mx-auto w-full px-4 py-6 md:px-8">
          <Switch>
            <PrivateRoute
              path="/user/dashboard"
              exact
              component={UserDashboard}
            />
            <Redirect from="/user" to="/user/dashboard" />
          </Switch>
        </div>
      </div>
    </>
  );
}
