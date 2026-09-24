import React, { Suspense, useEffect } from "react";
import {
  Switch,
  Route,
  Redirect,
  Link,
  useLocation,
  useHistory,
} from "react-router-dom";
import { PiBellLight, PiSignOutLight, PiWifiSlashLight } from "react-icons/pi";

import useNoIndex from "utils/useNoIndex";
import { useMediaQuery } from "react-responsive";
import { useSajatErtesitesek } from "utils/useSajatErtesitesek.js";
import { ensurePushSubscriptionSynced } from "utils/pushSubscribe.js";
import BottomNav from "components/UI/BottomNav.js";
import Spinner from "components/UI/Spinner.js";
import HibaHatar from "components/UI/HibaHatar.js";
import { toast } from "utils/toast";
import { useOnline } from "utils/useOnline.js";
import { sorUritese } from "utils/feltoltesiSor.js";
import { kijelentkezes } from "utils/kijelentkezes";

const UserDashboard = React.lazy(() => import("views/user/Dashboard.js"));
const JarmuValaszto = React.lazy(() => import("views/user/JarmuValaszto.js"));
const PotkocsiValaszto = React.lazy(
  () => import("views/user/PotkocsiValaszto.js"),
);
const FurgonValaszto = React.lazy(() => import("views/user/FurgonValaszto.js"));
const BejelentesUj = React.lazy(() => import("views/user/BejelentesUj.js"));
const Bejelentesek = React.lazy(() => import("views/user/Bejelentesek.js"));
const Profil = React.lazy(() => import("views/user/Profil.js"));
const Ertesitesek = React.lazy(() => import("views/user/Ertesitesek.js"));
const Helyszinek = React.lazy(() => import("views/user/Helyszinek.js"));
const HelyszinReszletek = React.lazy(() => import("views/user/HelyszinReszletek.js"));
const Fuvarok = React.lazy(() => import("views/user/Fuvarok.js"));
const FuvarReszletek = React.lazy(() => import("views/user/FuvarReszletek.js"));

// Ugyanaz a második védelmi vonal, mint layouts/Admin.js PrivateRoute-jában
// (ld. ott a komment) — egy admin-munkamenet böngészőbe írva egy
// /user/... URL-t korábban ide is bejutott; most `is_admin` esetén az
// admin saját (működő) /admin/dashboard-jára kerül.
const PrivateRoute = ({ component: Component, ...rest }) => {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }
  const isAuthenticated = !!user;
  const isAdmin = !!user?.is_admin;
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated && !isAdmin ? (
          <Component {...props} />
        ) : (
          <Redirect to={isAuthenticated ? "/admin/dashboard" : "/auth/login"} />
        )
      }
    />
  );
};

const desktopLinks = [
  { to: "/user/dashboard", label: "Ma" },
  { to: "/user/fuvarok", label: "Fuvarjaim" },
  { to: "/user/bejelentesek", label: "Bejelentéseim" },
  { to: "/user/helyszinek", label: "Helyek" },
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
  const { ujSzam } = useSajatErtesitesek();

  const handleLogout = async () => {
    await kijelentkezes();
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
            {ujSzam > 0 && (
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

  // Ha a böngésző korábban már megkapta az értesítési engedélyt, de a
  // tényleges push-feliratkozás időközben elveszett (kijelentkezés,
  // eszközváltás, service worker-frissítés), ez néma, gesztus nélküli
  // újra-feliratkozást próbál minden sofőr-oldali betöltéskor — nem kér
  // új engedélyt, csak akkor csinál bármit, ha az már "granted" (ld.
  // utils/pushSubscribe.js).
  useEffect(() => {
    ensurePushSubscriptionSynced();
  }, []);

  const online = useOnline();
  const asztali = useMediaQuery({ minWidth: 768 });
  useEffect(() => {
    if (!online) return;
    sorUritese().then(({ feltoltve, hibak } = {}) => {
      if (feltoltve > 0) toast.success(`${feltoltve} függőben lévő fotó feltöltve.`);
      (hibak || []).forEach((h) => toast.error(h));
    });
  }, [online]);

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`@media (min-width: 768px) { .mobil-fejlec { top: 57px !important; } }`}</style>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 bg-slate-50 md:hidden"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      {asztali && <DesktopNav />}
      {!online && (
        <div
          className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-ink-800 px-4 py-2 text-sm font-medium text-white"
          style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
          role="status"
        >
          <PiWifiSlashLight className="h-4 w-4 flex-shrink-0" />
          Nincs internetkapcsolat — a legutóbb betöltött adatokat látod.
        </div>
      )}
      <div
        className="mx-auto w-full max-w-lg px-4 pb-24 md:max-w-3xl md:pb-10 md:pt-6"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <HibaHatar>
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
              path="/user/furgon-valaszto"
              exact
              component={FurgonValaszto}
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
            <PrivateRoute path="/user/fuvarok" exact component={Fuvarok} />
            <PrivateRoute
              path="/user/fuvarReszletek"
              exact
              component={FuvarReszletek}
            />
            <Redirect from="/user" to="/user/dashboard" />
          </Switch>
        </Suspense>
        </HibaHatar>
      </div>
      <BottomNav />
    </div>
  );
}
