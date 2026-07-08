import { React, useState } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";

// ---------------------------------------------------------------------------
// Apró, függőségmentes ikonok (inline SVG) — ugyanazt a stroke-stílust
// használják, mint az eredeti "Vissza" nyíl, hogy egységes legyen a kép.
// ---------------------------------------------------------------------------
function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M3 7l8.5 6 8.5-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="1.8" />
      <path strokeLinecap="round" strokeWidth="1.8" d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path strokeLinecap="round" strokeWidth="1.8" d="M12 8v5" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M3 7h11v8H3zM14 11h4l3 3v1h-7zM6 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M12 7v5l3.5 2"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="3"
      />
      <path
        d="M21.5 12a9.5 9.5 0 00-9.5-9.5"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const BRAND_FEATURES = [
  { icon: TruckIcon, label: "Belföldi és nemzetközi fuvarok egy helyen" },
  { icon: ShieldIcon, label: "Biztonságos, jogosultság alapú hozzáférés" },
  { icon: ClockIcon, label: "Naprakész állapot, bármikor elérhető" },
];

export default function Bejelentkezes() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Kérjük töltsd ki mindkét mezőt!");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await fetchAction("loginUser", {
        email: email,
        password: password,
      });
      if (result && result.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));

        if (result.user.admin) {
          history.push("/admin/dashboard");
        } else {
          history.push("/user/dashboard");
        }
      } else {
        setError(result.message || "Hibás email vagy jelszó!");
      }
    } catch (err) {
      setError("Hiba történt a bejelentkezés során!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const navigateToHome = () => {
    history.push("/");
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#F2F3F5] font-sans">
      {/* Halvány, lebegő gradiens foltok — ugyanaz a hero-motívum, mint a Landing oldalon */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-[#1E3AA8]/15 blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-[#1E3AA8]/10 blur-3xl"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          {/* Bal oszlop — branding, világos háttér (csak lg-től) */}
          <div className="hidden lg:block">
            <h1 className="font-[Overpass] font-extrabold text-4xl xl:text-5xl leading-[1.1] text-[#23262B] tracking-tight mb-5">
              Üdvözöljük
              <br />
              <span className="text-[#1E3AA8]">újra.</span>
            </h1>
            <p className="text-lg text-[#23262B]/70 max-w-sm text-balance mb-10">
              Jelentkezzen be a flottakezelő rendszerbe a fuvarok, dokumentumok
              és karbantartások eléréséhez.
            </p>

            <div className="space-y-4">
              {BRAND_FEATURES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 text-sm text-[#23262B]/70"
                >
                  <span className="w-9 h-9 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                    <Icon />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Jobb oszlop — bejelentkező kártya (signature elem, mint a Landing hero ajánlatkérője) */}
          <div className="relative bg-[#2E3239]/90 backdrop-blur-md border border-white/10 rounded-xl p-8 md:p-10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E3AA8] to-[#172E86]"></div>

            <div className="flex items-center justify-between mb-6 lg:hidden">
              <img
                src="/logo2.png"
                alt="Szikora Transz Kft"
                className="h-8 w-auto"
              />
              <button
                type="button"
                onClick={navigateToHome}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-[Overpass] font-semibold transition-colors duration-300"
              >
                <BackIcon />
                Vissza
              </button>
            </div>

            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#7C93FF]">
              Belépés
            </span>
            <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-white mt-3 mb-3">
              Bejelentkezés
            </h2>
            <p className="text-white/60 mb-8">
              Kérjük adja meg belépési adatait a fiókja eléréséhez.
            </p>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-3 mb-6 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-300"
              >
                <span className="flex-shrink-0 mt-0.5">
                  <AlertIcon />
                </span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2"
                >
                  Email cím
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    id="email"
                    placeholder="email@pelda.hu"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mb-2"
                >
                  Jelszó
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                    <LockIcon />
                  </span>
                  <input
                    type="password"
                    id="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full mt-7 px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Bejelentkezés...
                </>
              ) : (
                "Bejelentkezés"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
