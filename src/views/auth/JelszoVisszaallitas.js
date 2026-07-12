import { React, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="1.8" />
      <path strokeLinecap="round" strokeWidth="1.8" d="M8 11V7a4 4 0 018 0v4" />
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

// A backend `requestPasswordReset()` erre az útvonalra linkel ki
// (ApiHandler.php: "https://szikora-transz.hu/auth/jelszo-visszaallitas?token=...").
export default function JelszoVisszaallitas() {
  const history = useHistory();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setError("Hiányzó vagy érvénytelen hivatkozás.");
      return;
    }
    if (password.length < 8) {
      setError("A jelszónak legalább 8 karakter hosszúnak kell lennie.");
      return;
    }
    if (password !== confirm) {
      setError("A két jelszó nem egyezik.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await fetchAction("resetPassword", { token, password });
      if (result?.success) {
        setDone(true);
      } else {
        setError(result?.message || "A hivatkozás érvénytelen vagy lejárt.");
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

          <div className="flex items-center justify-center mb-6">
            <img src="/logo2.png" alt="Szikora Transz Kft" className="h-8 w-auto" />
          </div>

          <h2 className="font-[Overpass] font-extrabold text-2xl text-white mt-3 mb-3">Új jelszó beállítása</h2>

          {done ? (
            <>
              <div
                role="status"
                className="mb-7 flex items-start gap-3 p-4 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              >
                <span className="flex-shrink-0 mt-0.5">
                  <CheckIcon />
                </span>
                <span>A jelszavad megváltozott. Most már bejelentkezhetsz vele.</span>
              </div>
              <button
                type="button"
                onClick={() => history.push("/auth/login")}
                className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                Bejelentkezés
              </button>
            </>
          ) : (
            <>
              <p className="text-white/60 mb-8">Add meg az új jelszavadat kétszer, a megerősítéshez.</p>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-6 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-300"
                >
                  {error}
                </div>
              )}

              <div className="space-y-5 mb-7">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2"
                  >
                    Új jelszó
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <LockIcon />
                    </span>
                    <input
                      type="password"
                      id="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="confirm"
                    className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2"
                  >
                    Új jelszó megerősítése
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <LockIcon />
                    </span>
                    <input
                      type="password"
                      id="confirm"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                    />
                  </div>
                </div>
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
                    Mentés...
                  </>
                ) : (
                  "Jelszó beállítása"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
