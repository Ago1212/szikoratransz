import React from "react";
import { Link } from "react-router-dom";
import { PiArrowLeftLight } from "react-icons/pi";

export default function Navbar() {
  return (
    <nav className="absolute top-0 z-50 flex w-full flex-wrap items-center justify-between px-4 py-5 md:px-8">
      <Link to="/landing" className="flex items-center gap-2.5">
        <img
          src="/logo.png"
          alt="Szikora Transz Kft"
          className="h-10 w-auto mb-8"
        />
      </Link>
      <Link
        to="/landing"
        className="flex items-center gap-2 bg-[#1E3AA8] hover:bg-[#172E86] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-300"
      >
        <PiArrowLeftLight className="h-3.5 w-3.5" />
        Főoldal
      </Link>
    </nav>
  );
}
