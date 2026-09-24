import React, { useEffect, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
  PiSunLight,
  PiSunFill,
  PiMapPinLight,
  PiMapPinFill,
  PiClipboardTextLight,
  PiClipboardTextFill,
  PiUserLight,
  PiUserFill,
  PiPlusBold,
  PiCameraLight,
  PiWarningLight,
  PiMapPinPlusLight,
  PiXLight,
} from "react-icons/pi";
import { toast } from "utils/toast";
import { gyorsitotarazottLekeres } from "utils/soforCache";
import { kovetkezoFuvar } from "utils/fuvarIdo";

// Négy egyenrangú fül + középen egy "+" gyorsművelet-gomb (2026-09-24,
// UX-átvilágítás): a kiemelt középső gomb mobilos konvenció szerint
// MŰVELETET indít, nem oldalt nyit — a korábbi "Fuvarok" FAB miatt a
// Kezdőlapon két fül látszott aktívnak, és a Bejelentés kikerült a
// menüsorból. A "+" alsó lapja a három leggyakoribb sofőr-műveletet adja
// bárhonnan egy-két érintéssel.
const bal = [
  { to: "/user/dashboard", label: "Ma", icon: PiSunLight, activeIcon: PiSunFill },
  { to: "/user/fuvarok", label: "Fuvarok", icon: PiClipboardTextLight, activeIcon: PiClipboardTextFill, alutvonalak: ["/user/fuvarReszletek"] },
];
const jobb = [
  { to: "/user/helyszinek", label: "Helyek", icon: PiMapPinLight, activeIcon: PiMapPinFill, alutvonalak: ["/user/helyszin-reszletek"] },
  { to: "/user/profil", label: "Profil", icon: PiUserLight, activeIcon: PiUserFill },
];

function useBillentyuzetNyitva() {
  const [nyitva, setNyitva] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const frissit = () => setNyitva(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", frissit);
    return () => vv.removeEventListener("resize", frissit);
  }, []);
  return nyitva;
}

function Ful({ item, active }) {
  const Icon = active ? item.activeIcon : item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 text-xs leading-none transition-colors duration-150 ${
        active ? "font-bold text-brand-600" : "font-medium text-ink-500"
      }`}
    >
      <Icon className="h-6 w-6" />
      {item.label}
    </Link>
  );
}

function MuveletSor({ icon: Icon, cim, leiras, szin, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[4rem] w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-ink-100 active:bg-slate-50"
    >
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${szin}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-ink-900">{cim}</span>
        <span className="block text-sm text-ink-500">{leiras}</span>
      </span>
    </button>
  );
}

export default function BottomNav() {
  const location = useLocation();
  const history = useHistory();
  const [lapNyitva, setLapNyitva] = useState(false);
  const [keres, setKeres] = useState(false);
  const billentyuzet = useBillentyuzetNyitva();

  useEffect(() => {
    setLapNyitva(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!lapNyitva) return undefined;
    const esc = (e) => e.key === "Escape" && setLapNyitva(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [lapNyitva]);

  const isActive = (item) =>
    location.pathname.startsWith(item.to) || (item.alutvonalak || []).some((p) => location.pathname.startsWith(p));

  const menetlevelFoto = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    setKeres(true);
    const { result } = await gyorsitotarazottLekeres("aktiv_fuvarok", "getSajatFuvarok", { sofor_id: user?.id, aktivOnly: true });
    setKeres(false);
    const fuvar = kovetkezoFuvar(result?.success ? result.fuvarok || [] : []);
    if (!fuvar) {
      toast.error("Nincs aktív fuvarod, amihez menetlevelet tölthetnél fel.");
      return;
    }
    history.push(`/user/fuvarReszletek?id=${fuvar.id}&feltoltes=menetlevel`);
  };

  if (billentyuzet) return null;

  return (
    <>
      {lapNyitva && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Gyorsműveletek">
          <button type="button" className="absolute inset-0 bg-ink-900/40" aria-label="Bezárás" onClick={() => setLapNyitva(false)} />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-slate-50 px-4 pt-3 shadow-soft-xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-bold text-brand-900">Mit szeretnél?</p>
              <button
                type="button"
                onClick={() => setLapNyitva(false)}
                aria-label="Bezárás"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-500 active:bg-slate-200"
              >
                <PiXLight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <MuveletSor
                icon={PiCameraLight}
                cim={keres ? "Fuvar keresése…" : "Menetlevél fotó"}
                leiras="A következő fuvarodhoz"
                szin="bg-brand-50 text-brand-600"
                onClick={menetlevelFoto}
              />
              <MuveletSor
                icon={PiWarningLight}
                cim="Bejelentés"
                leiras="Hiba, gumi, rakomány, egyéb"
                szin="bg-red-50 text-red-600"
                onClick={() => history.push("/user/bejelentes/uj")}
              />
              <MuveletSor
                icon={PiMapPinPlusLight}
                cim="Új hely"
                leiras="Jegyzet egy felrakó- / lerakóhelyről"
                szin="bg-emerald-50 text-emerald-600"
                onClick={() => history.push("/user/helyszinek?uj=1")}
              />
            </div>
          </div>
        </div>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-soft-lg md:hidden"
        aria-label="Fő navigáció"
      >
        {bal.map((item) => (
          <Ful key={item.to} item={item} active={isActive(item)} />
        ))}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={() => setLapNyitva(true)}
            aria-label="Gyorsműveletek: menetlevél fotó, bejelentés, új hely"
            aria-expanded={lapNyitva}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_10px_24px_-8px_rgba(37,99,235,0.55)] transition-transform duration-200 ease-fluid active:scale-90"
          >
            <PiPlusBold className="h-7 w-7" />
          </button>
        </div>
        {jobb.map((item) => (
          <Ful key={item.to} item={item} active={isActive(item)} />
        ))}
      </nav>
    </>
  );
}
