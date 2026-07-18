import React from "react";
import { createPopper } from "@popperjs/core";
import { Link, useHistory } from "react-router-dom";
import { PiCaretDownLight, PiGearLight, PiSignOutLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

const UserDropdown = ({ settingsPath = "/admin/settings" }) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const popoverRef = React.useRef(null);
  const history = useHistory();

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    user = null;
  }

  const openPopover = () => {
    createPopper(btnRef.current, popoverRef.current, {
      placement: "bottom-end",
      modifiers: [{ name: "offset", options: { offset: [0, 8] } }],
    });
    setOpen(true);
  };
  const closePopover = () => setOpen(false);

  React.useEffect(() => {
    const onClick = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !btnRef.current.contains(e.target)
      ) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    closePopover();
    const result = await fetchAction("logoutUser", { id: user?.id });
    localStorage.removeItem("user");
    localStorage.removeItem("sessionToken");
    if (!result?.success) {
      // Session already gone client-side regardless of server response.
      console.warn(result?.message || "Logout request failed.");
    }
    history.push("/");
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => (open ? closePopover() : openPopover())}
        className="group flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-all duration-300 ease-fluid hover:bg-brand-50"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white shadow-inner-hairline">
          {initials(user?.name || user?.nev)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm font-semibold leading-tight text-brand-900">
            {user?.name || user?.nev || "Fiók"}
          </span>
          <span className="block text-xs leading-tight text-ink-400">
            {user?.admin ? "Adminisztrátor" : "Sofőr"}
          </span>
        </span>
        <PiCaretDownLight
          className={`hidden h-3.5 w-3.5 text-ink-400 transition-transform duration-300 ease-fluid md:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        ref={popoverRef}
        className={`${
          open ? "animate-scale-in" : "hidden"
        } z-50 min-w-56 rounded-2xl border border-ink-100 bg-white p-1.5 shadow-soft-lg`}
      >
        <div className="border-b border-ink-100 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-brand-900">
            {user?.name || user?.nev || "Fiók"}
          </p>
          <p className="truncate text-xs text-ink-400">{user?.email || ""}</p>
        </div>
        <div className="py-1">
          <Link
            to={settingsPath}
            onClick={closePopover}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700"
          >
            <PiGearLight className="h-4 w-4" />
            Saját adatok
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50"
          >
            <PiSignOutLight className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </div>
    </>
  );
};

export default UserDropdown;
