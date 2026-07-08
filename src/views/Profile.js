import React from "react";
import { Link } from "react-router-dom";
import { PiUserCircleLight, PiArrowRightLight } from "react-icons/pi";

export default function Profile() {
  let user = null;
  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch (e) {
    user = null;
  }
  const settingsPath = user?.admin ? "/admin/settings" : "/user/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-ink-100">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <PiUserCircleLight className="h-7 w-7" />
        </span>
        <h1 className="mt-6 font-display text-xl font-bold text-brand-900">
          {user?.name || user?.nev || "Fiókod"}
        </h1>
        <p className="mt-2 text-sm text-ink-400">{user?.email}</p>
        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          A fiókadataidat a Saját adatok felületen tekintheted meg és
          szerkesztheted.
        </p>
        <Link
          to={user ? settingsPath : "/auth/login"}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-[0.98]"
        >
          {user ? "Saját adatok megnyitása" : "Bejelentkezés"}
          <PiArrowRightLight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
