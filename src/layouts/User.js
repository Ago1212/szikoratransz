import React, { Suspense } from "react";
import {
  Switch,
  Route,
  Redirect,
  Link,
  useLocation,
  useHistory,
} from "react-router-dom";
import { PiBellLight, PiSignOutLight } from "react-icons/pi";

import useNoIndex from "utils/useNoIndex";
import { fetchAction } from "utils/fetchAction";
import { useSajatErtesitesek } from "utils/useSajatErtesitesek.js";
import BottomNav from "components/UI/BottomNav.js";
import Spinner from "components/UI/Spinner.js";

const UserDashboard = React.lazy(() => import("views/user/Dashboard.js"));
const JarmuValaszto = React.lazy(() => import("views/user/JarmuValaszto.js"));
const PotkocsiValaszto = React.lazy(
  () => import("views/user/PotkocsiValaszto.js"),
);
const BejelentesUj = React.lazy(() => import("views/user/BejelentesUj.js"));
const Bejelentesek = React.lazy(() => import("views/user/Bejelentesek.js"));
const Tankolas = React.lazy(() => import("views/user/Tankolas.js"));
const Profil = React.lazy(() => import("views/user/Profil.js"));
const Ertesitesek = React.lazy(() => import("views/user/Ertesitesek.js"));
const VezetesiIdo = React.lazy(() => import("views/user/VezetesiIdo.js"));
const Helyszinek = React.lazy(() => import("views/user/Helyszinek.js"));
const HelyszinReszletek = React.lazy(() => import("views/user/HelyszinReszletek.js"));

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

const desktopLinks = [
  { to: "/user/dashboard", label: "Kezdőlap" },
  { to: "/user/bejelentesek", label: "Bejelentéseim" },
  { to: "/user/helyszinek", label: "Helyszínek" },
  { to: "/user/tankolas", label: "Tankolás" },
  { to: "/user/vezetesi-ido", label: "Vezetési idő" },
  { to: "/user/profil", label: "Profil" },
];

// Asztali navigáció — a sofőr oldal elsődlegesen mobilra készült
// (bottom nav + max-w-lg egykezes oszlop), de böngészőből, szélesebb
// ablakban is használható kell legyen: itt egy egyszerű felső sáv
// váltja a mobil bottom nav-ot, és a tartalom-oszlop is szélesebbre
// nyílik (ld. layout lent). A BottomNav ilyenkor `md:hidden`.
function DesktopNav() {
  const location = useLocation();
  const history = useHistory();
  const isActive = (path) => location.pathname.startsWith(path);
  const { osszesSzam } = useSajatErtesitesek();

  const handleLogout = async () => {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    await fetchAction("logoutUser", { id: user?.id });
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("sessionToken");
    history.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-30 hidden border-b border-ink-100 bg-white md:block">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <Link
          to="/user/dashboard"
          className="flex items-center gap-2.5 flex-shrink-0"
        >
          <img
            src="/logo2.svg"
            alt="Szikora Transz Kft"
            className="h-7 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1">
          {desktopLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive(link.to)
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-500 hover:bg-slate-100 hover:text-ink-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            to="/user/ertesitesek"
            className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 ${
              isActive("/user/ertesitesek")
                ? "bg-brand-50 text-brand-600"
                : "text-ink-400 hover:bg-slate-100"
            }`}
            aria-label="Értesítések"
          >
            <PiBellLight className="h-[18px] w-[18px]" />
            {osszesSzam > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Link>
          <Link
            to="/user/bejelentes/uj"
            className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-red-700"
          >
            Bejelentés
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
            aria-label="Kijelentkezés"
          >
            <PiSignOutLight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default function User() {
  useNoIndex();
  return (
    <div className="min-h-screen bg-slate-50">
      <DesktopNav />
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-5 md:max-w-3xl md:pb-10 md:pt-6">
        <Suspense
          fallback={<Spinner wrapperClassName="flex justify-center py-20" />}
        >
          <Switch>
            <PrivateRoute
              path="/user/dashboard"
              exact
              component={UserDashboard}
            />
            <PrivateRoute
              path="/user/jarmu-valaszto"
              exact
              component={JarmuValaszto}
            />
            <PrivateRoute
              path="/user/potkocsi-valaszto"
              exact
              component={PotkocsiValaszto}
            />
            <PrivateRoute
              path="/user/bejelentes/uj"
              exact
              component={BejelentesUj}
            />
            <PrivateRoute
              path="/user/bejelentesek"
              exact
              component={Bejelentesek}
            />
            <PrivateRoute path="/user/tankolas" exact component={Tankolas} />
            <PrivateRoute path="/user/vezetesi-ido" exact component={VezetesiIdo} />
            <PrivateRoute path="/user/profil" exact component={Profil} />
            <PrivateRoute
              path="/user/ertesitesek"
              exact
              component={Ertesitesek}
            />
            <PrivateRoute path="/user/helyszinek" exact component={Helyszinek} />
            <PrivateRoute
              path="/user/helyszin-reszletek"
              exact
              component={HelyszinReszletek}
            />
            <Redirect from="/user" to="/user/dashboard" />
          </Switch>
        </Suspense>
      </div>
      <BottomNav />
    </div>
  );
}
