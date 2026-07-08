import React from "react";
import { Link } from "react-router-dom";
import { PiEnvelopeSimpleLight, PiShieldCheckLight } from "react-icons/pi";

export default function Register() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-10 text-center shadow-soft-xl backdrop-blur-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-200">
          <PiShieldCheckLight className="h-7 w-7" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold text-white">
          Fiókot csak adminisztrátor hozhat létre
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          A Szikora Transz rendszerbe nincs önálló regisztráció — a sofőr és
          adminisztrátor fiókokat a flottamenedzsment csapat hozza létre.
          Ha még nincs belépésed, keresd az adminisztrátort.
        </p>
        <a
          href="mailto:szikoratransz@gmail.com"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-200 transition-colors duration-300 hover:text-white"
        >
          <PiEnvelopeSimpleLight className="h-4 w-4" />
          szikoratransz@gmail.com
        </a>
        <Link
          to="/auth/login"
          className="mt-8 block w-full rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft-lg transition-all duration-300 ease-fluid hover:bg-brand-600 active:scale-[0.98]"
        >
          Vissza a bejelentkezéshez
        </Link>
      </div>
    </div>
  );
}
