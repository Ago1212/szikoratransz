import React from "react";
import { useHistory } from "react-router-dom";
import { PiSignOutLight } from "react-icons/pi";

// components

import CardSettings from "components/Cards/CardSettings.js";
import { fetchAction } from "utils/fetchAction";

export default function Settings() {
  const history = useHistory();

  // Ugyanaz a kijelentkezés-logika, mint a Sidebar.js deszktop lábléce —
  // mobilon a Kijelentkezés korábban az alsó nav egy örökké látható,
  // ikon-only oszlopa volt (a keresés/értesítés FAB-okkal együtt 8-ra
  // duzzasztva a sávot); mostantól a Profil oldal egy tartalom-eleme,
  // ugyanúgy, ahogy a legtöbb mobil appban a kijelentkezés a fiók/profil
  // képernyő része, nem egy örökké kint lévő navigációs fül.
  const handleLogout = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const result = await fetchAction("logoutUser", { id: user?.id });
    localStorage.removeItem("user");
    localStorage.removeItem("sessionToken");
    if (!result?.success) {
      console.warn(result?.message || "Logout request failed.");
    }
    history.push("/");
  };

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-12/12 px-4">
          <CardSettings />
        </div>
        <div className="w-full px-4 mt-4 md:hidden">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3.5 py-3 text-sm font-semibold text-red-600 shadow-soft transition-colors duration-200 hover:bg-red-50"
          >
            <PiSignOutLight className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </div>
    </>
  );
}
