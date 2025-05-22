// AdminNavbar.js
import React from "react";
import UserDropdown from "components/Dropdowns/UserDropdown.js";

export default function Navbar() {
  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 shadow-md">
      <div className="px-4 md:px-8 mx-auto w-full">
        <nav className="absolute top-0 left-0 w-full z-10 bg-transparent md:flex-row md:flex-nowrap md:justify-start flex items-center p-4">
          <div className="w-full mx-auto items-center flex justify-between md:flex-nowrap flex-wrap md:px-4 px-0"></div>
        </nav>
      </div>
    </div>
  );
}
