/*eslint-disable*/
import React from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
  FiHome,
  FiTruck,
  FiUsers,
  FiFile,
  FiCalendar,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";
import { FaTrailer, FaComments } from "react-icons/fa";
import { RiDashboardLine } from "react-icons/ri";

import NotificationDropdown from "components/Dropdowns/NotificationDropdown.js";
import UserDropdown from "components/Dropdowns/UserDropdown.js";
import { fetchAction } from "utils/fetchAction";

export default function Sidebar() {
  const storedUserData = sessionStorage.getItem("user");
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const history = useHistory();
  const location = useLocation();

  const handleLogout = async () => {
    const result = await fetchAction("logoutUser", { id: storedUserData.id });
    if (result?.success) {
      sessionStorage.removeItem("user");
      history.push("/");
    } else {
      alert(result?.message || "Logout failed.");
    }
  };

  const isActive = (path) => location.pathname.includes(path);

  const NavItem = ({ to, icon: Icon, text, subPath }) => (
    <li className="items-center">
      <Link
        className={`flex items-center py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
          isActive(subPath || to)
            ? "bg-blue-50 text-blue-600"
            : "text-gray-700 hover:bg-gray-100"
        }`}
        to={to}
        onClick={() => setIsMobileOpen(false)}
      >
        <Icon
          className={`mr-3 ${
            isActive(subPath || to) ? "text-blue-500" : "text-gray-400"
          }`}
        />
        {text}
      </Link>
    </li>
  );

  const SectionHeader = ({ children }) => (
    <h6 className="text-gray-500 text-xs uppercase font-semibold tracking-wider px-4 pt-4 pb-2">
      {children}
    </h6>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg flex flex-col z-30 transition-all duration-300 ease-in-out transform ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand & Mobile Toggle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <Link
            to="/"
            className="text-xl font-bold text-blue-600 hover:text-blue-700 flex items-center"
            onClick={() => setIsMobileOpen(false)}
          >
            <RiDashboardLine className="mr-2" />
            Főoldal
          </Link>
          <button
            className="md:hidden text-gray-500 hover:text-gray-700 focus:outline-none"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            <i className={`fas ${isMobileOpen ? "fa-times" : "fa-bars"}`} />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Personal Data Section */}
            <SectionHeader>Saját adatok</SectionHeader>
            <ul className="space-y-1">
              <NavItem
                to="/admin/dashboard"
                icon={RiDashboardLine}
                text="Főmenü"
              />
              <NavItem
                to="/admin/settings"
                icon={FiSettings}
                text="Saját adatok"
              />
            </ul>

            <SectionHeader>Járművek</SectionHeader>
            <ul className="space-y-1">
              <NavItem to="/admin/kamionok" icon={FiTruck} text="Kamionok" />
              <NavItem to="/admin/potkocsi" icon={FaTrailer} text="Pótkocsik" />
            </ul>

            <SectionHeader>Alkalmazottak</SectionHeader>
            <ul className="space-y-1">
              <NavItem to="/admin/soforok" icon={FiUsers} text="Sofőrök" />
              <NavItem
                to="/admin/bejelentesek"
                icon={FaComments}
                text="Bejelentések"
              />
            </ul>

            <SectionHeader>Egyéb</SectionHeader>
            <ul className="space-y-1">
              <NavItem to="/admin/fajlok" icon={FiFile} text="Fájlok" />
              <NavItem
                to="/admin/esemenyek"
                icon={FiCalendar}
                text="Események"
              />
            </ul>
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors"
          >
            <FiLogOut className="mr-2" />
            Kijelentkezés
          </button>
        </div>
      </nav>

      {/* Mobile Menu Button */}
      <button
        className="fixed bottom-4 left-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-20 md:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <i className="fas fa-bars"></i>
      </button>
    </>
  );
}
