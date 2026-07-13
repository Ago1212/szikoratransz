import { React, useState } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M3 7l8.5 6 8.5-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 00-9.5-9.5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// A Login.js dark-card vizuális nyelvét követi (ugyanaz a szín-/betű-
// paletta), de egyetlen, reszponzív fát használ a mobil/desktop kettős-fa
// helyett — ez egy ritkán látogatott, másodlagos folyamat, nem indokolt a
// Login.js teljes kétágú felépítését megismételni hozzá.
export default function ElfelejtettJelszo() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const history = useHistory();

  const handleSubmit = async () => {
    if (!email) {
      setError("Add meg az email címed!");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchAction("requestPasswordReset", { email });
      // A backend szándékosan mindig sikeres választ ad (ld. ApiHandler
      // requestPasswordReset komment) — ez nem árulja el, létezik-e az
      // email cím a rendszerben.
      if (result?.success) {
        setSent(true);
      } else {
        setError(result?.message || "Hiba történt, próbáld újra.");
      }
    } catch (err) {
      setError("Hiba történt, próbáld újra.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] h-full w-full overflow-y-auto bg-[#F2F3F5] font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-[#1E3AA8]/10 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex min-h-full w-full items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-md bg-[#2E3239]/90 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E3AA8] to-[#172E86]"></div>

          <div className="flex items-center justify-between mb-6">
            <img src="/logo2.png" alt="Szikora Transz Kft" className="h-8 w-auto" />
            <button
              type="button"
              onClick={() => history.push("/auth/login")}
              className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-[Overpass] font-semibold transition-colors duration-300"
            >
              <BackIcon />
              Vissza
            </button>
          </div>

          <h2 className="font-[Overpass] font-extrabold text-2xl text-white mt-3 mb-3">Elfelejtett jelszó</h2>

          {sent ? (
            <div
              role="status"
              className="flex items-start gap-3 p-4 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
            >
              <span className="flex-shrink-0 mt-0.5">
                <CheckIcon />
              </span>
              <span>
                Ha ez az email cím létezik nálunk, hamarosan kapsz egy linket a jelszavad
                beállításához. Ellenőrizd a postaládádat (és a spam mappát is).
              </span>
            </div>
          ) : (
            <>
              <p className="text-white/60 mb-8">
                Add meg a fiókodhoz tartozó email címet, és küldünk egy linket az új jelszó
                beállításához.
              </p>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-6 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-300"
                >
                  {error}
                </div>
              )}

              <label
                htmlFor="email"
                className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2"
              >
                Email cím
              </label>
              <div className="relative mb-7">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  id="email"
                  placeholder="email@pelda.hu"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Küldés...
                  </>
                ) : (
                  "Link küldése"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
