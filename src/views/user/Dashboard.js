import React, { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import {
  PiBellLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiChatCircleTextLight,
  PiCaretRightLight,
  PiClipboardTextLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import Spinner from "components/UI/Spinner.js";
import {
  DOCUMENT_FIELDS,
  getDocumentStatus,
  daysUntil,
} from "utils/documentStatus.js";

// A BottomNav középső FAB-ja 2026-07-28 óta Fuvarokra vezet, nem
// Bejelentésre (ld. BottomNav.js komment) — a Bejelentés emiatt egy
// ideig a Dashboard "Gyors műveletek" rácsában kapott helyet. A rács
// többi eleme (Kamion/Pótkocsi/Furgon/Helyszínek) redundáns volt a lenti
// "Aktív jármű" kártyákkal és a BottomNav-val, a Diszpécser-hívás pedig
// alig használt — explicit felhasználói kérésre a rács megszűnt, a
// Bejelentés önálló, kiemelt gombként maradt az egyetlen "gyors
// művelet"-ként.
export default function UserDashboard() {
  const history = useHistory();
  const [user, setUser] = useState(null);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [furgonok, setFurgonok] = useState([]);
  const [sajatBejelentesek, setSajatBejelentesek] = useState([]);
  const [bejelentesValaszolt, setBejelentesValaszolt] = useState(false);
  const [elbiraltJarmuValtasok, setElbiraltJarmuValtasok] = useState([]);
  const [kerelmek, setKerelmek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aktivFuvarok, setAktivFuvarok] = useState([]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user"));
    if (!userData) {
      history.push("/auth/login");
      return;
    }
    setUser(userData);

    const load = async () => {
      // A localStorage-ban tárolt `user` a bejelentkezéskori állapot —
      // ha időközben az admin jóváhagyott egy jármű-váltási kérést, ez
      // frissíti a kamion/aktiv_potkocsi mezőket anélkül, hogy ki kellene
      // jelentkezni.
      const [
        freshRes,
        kamionRes,
        potkocsiRes,
        furgonRes,
        bejelentesRes,
        kerelemRes,
        elbiraltRes,
        fuvarRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
        fetchAction("getSajatFuvarok", { sofor_id: userData.id, aktivOnly: true }),
      ]);
      if (freshRes?.success && freshRes.user) {
        const merged = { ...userData, ...freshRes.user };
        localStorage.setItem("user", JSON.stringify(merged));
        setUser(merged);
      }
      if (kamionRes?.success) setKamionok(kamionRes.kamionok || []);
      if (potkocsiRes?.success) setPotkocsik(potkocsiRes.potkocsik || []);
      if (furgonRes?.success) setFurgonok(furgonRes.furgonok || []);
      if (bejelentesRes?.success) {
        const osszes = bejelentesRes.bejelentesek || [];
        setSajatBejelentesek(osszes.slice(0, 3));
        setBejelentesValaszolt(
          osszes.some((b) => b.statusz !== "uj" || b.admin_valasz),
        );
      }
      if (kerelemRes?.success) setKerelmek(kerelemRes.kerelmek || []);
      if (elbiraltRes?.success)
        setElbiraltJarmuValtasok(elbiraltRes.kerelmek || []);
      if (fuvarRes?.success) setAktivFuvarok(fuvarRes.fuvarok || []);
      setLoading(false);
    };
    load();
  }, [history]);

  if (loading || !user) {
    return <Spinner wrapperClassName="flex justify-center py-24" />;
  }

  const aktivKamion = kamionok.find(
    (k) => String(k.id) === String(user.kamion),
  );
  const aktivPotkocsi = potkocsik.find(
    (p) => String(p.id) === String(user.aktiv_potkocsi),
  );
  const aktivFurgon = furgonok.find(
    (f) => String(f.id) === String(user.furgon),
  );
  const pendingKamion = kerelmek.find((k) => k.tipus === "kamion");
  const pendingPotkocsi = kerelmek.find((k) => k.tipus === "potkocsi");
  const pendingFurgon = kerelmek.find((k) => k.tipus === "furgon");

  const lejaroDokumentumok = DOCUMENT_FIELDS.map((field) => ({
    ...field,
    days: daysUntil(user[field.key]),
    status: getDocumentStatus(user[field.key]),
  })).filter((d) => d.status === "expired" || d.status === "warning");

  // A haranG korábban csak a lejáró dokumentumokat jelezte — most a
  // megválaszolt bejelentéseket és az elbírált jármű-váltási kérelmeket is,
  // ugyanúgy, mint az Ertesitesek.js oldal (ld. useSajatErtesitesek.js).
  const vanErtesitesJelzes =
    lejaroDokumentumok.length > 0 ||
    bejelentesValaszolt ||
    elbiraltJarmuValtasok.length > 0;

  // A sofőr nevek a magyar névsorrendet követik (vezetéknév + keresztnév,
  // pl. "Szikora Ágoston") — a keresztnév ezért az UTOLSÓ szótöveg, nem az
  // első (az angol névsorrenddel ellentétben). Az üdvözlésben a keresztnév
  // a természetes, baráti forma.
  const nevReszek = (user.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nevReszek[nevReszek.length - 1] || "";

  return (
    <div className="flex flex-col gap-4">
      {/* Üdvözlés + értesítés */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Szia,
          </p>
          <h1 className="font-display text-xl font-bold text-brand-900">
            {firstName || user.name}
          </h1>
        </div>
        <Link
          to="/user/ertesitesek"
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-500 shadow-soft md:hidden"
          aria-label="Értesítések"
        >
          <PiBellLight className="h-5 w-5" />
          {vanErtesitesJelzes && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Link>
      </div>

      {/* Aktív fuvarjaim — a Fuvar-first munkafolyamat elsődleges napi
          művelete (ld. docs/superpowers/specs/2026-07-28-fuvar-first-
          workflow-design.md 6.2), ezért ez a legfelső, legnagyobb súlyú
          kártya — a jármű-hozzárendelés (lentebb) ritkábban változik,
          mint a napi fuvarok. */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-base font-bold text-brand-900">Aktív fuvarjaim</p>
          <PiClipboardTextLight className="h-5 w-5 text-brand-500" />
        </div>
        {aktivFuvarok.length === 0 ? (
          <p className="text-sm text-brand-700">Nincs aktív fuvarod.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {aktivFuvarok.slice(0, 3).map((f) => (
              <Link
                key={f.id}
                to="/user/fuvarReszletek"
                onClick={(e) => {
                  // history.push state-tel gyorsabb, mint egy plain <Link>
                  // (nincs extra getSajatFuvar lekérdezés) — ezért kézzel
                  // navigálunk ahelyett, hogy a Link natív navigációjára
                  // hagyatkoznánk.
                  e.preventDefault();
                  history.push("/user/fuvarReszletek", { data: f });
                }}
                className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-ink-800">
                  {f.felrako_ceg || "—"} → {f.lerako_ceg || "—"}
                </span>
                <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
              </Link>
            ))}
            {aktivFuvarok.length > 3 && (
              <Link
                to="/user/fuvarok"
                className="text-center text-xs font-semibold text-brand-700"
              >
                Összes fuvarod ({aktivFuvarok.length})
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Aktív jármű — az üres állapot szövege egységesen "Válassz"
          minden kártyán (a fölötte lévő KAMION/PÓTKOCSI/FURGON címke már
          jelzi, mire vonatkozik), hogy a 3 kártya sora azonos magasságú
          maradjon, ne törjön el köztük egy csak a hosszabb szó miatt. */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/user/jarmu-valaszto"
          className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <PiTruckLight className="h-4 w-4" />
            Kamion
          </div>
          {aktivKamion ? (
            <>
              <p className="mt-1.5 font-display text-lg font-bold text-brand-900">
                {aktivKamion.rendszam}
              </p>
              <p className="truncate text-xs text-ink-500">
                {aktivKamion.tipus || "—"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-brand-600">
              Válassz
            </p>
          )}
          {pendingKamion && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
              Vár jóváhagyásra
            </p>
          )}
        </Link>
        <Link
          to="/user/potkocsi-valaszto"
          className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <PiTruckTrailerLight className="h-4 w-4" />
            Pótkocsi
          </div>
          {aktivPotkocsi ? (
            <>
              <p className="mt-1.5 font-display text-lg font-bold text-brand-900">
                {aktivPotkocsi.rendszam}
              </p>
              <p className="truncate text-xs text-ink-500">
                {aktivPotkocsi.tipus || "—"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-brand-600">
              Válassz
            </p>
          )}
          {pendingPotkocsi && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
              Vár jóváhagyásra
            </p>
          )}
        </Link>
        <Link
          to="/user/furgon-valaszto"
          className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <PiVanLight className="h-4 w-4" />
            Furgon
          </div>
          {aktivFurgon ? (
            <>
              <p className="mt-1.5 font-display text-lg font-bold text-brand-900">
                {aktivFurgon.rendszam}
              </p>
              <p className="truncate text-xs text-ink-500">
                {aktivFurgon.tipus || "—"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-brand-600">
              Válassz
            </p>
          )}
          {pendingFurgon && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
              Vár jóváhagyásra
            </p>
          )}
        </Link>
      </div>

      {/* Fontos értesítések */}
      {lejaroDokumentumok.length > 0 && (
        <Link
          to="/user/ertesitesek"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <PiWarningCircleLight className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">
            {lejaroDokumentumok[0].label}{" "}
            {lejaroDokumentumok[0].days < 0
              ? "lejárt"
              : `${lejaroDokumentumok[0].days} nap múlva lejár`}
            {lejaroDokumentumok.length > 1 &&
              ` (+${lejaroDokumentumok.length - 1} további)`}
          </p>
          <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-amber-500" />
        </Link>
      )}

      {/* Bejelentés — egyetlen megmaradt "gyors művelet" a korábbi rács
          helyén (ld. a fájl tetejei komment). Tudatosan piros-tónusú
          háttér (nem sima fehér, mint a lenti "Legutóbbi bejelentéseim"
          sor) — ez egy LÉTREHOZÓ művelet, nem egy meglévő lista
          megnyitása, a vizuális megkülönböztetés ezt jelzi. */}
      <Link
        to="/user/bejelentes/uj"
        className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3.5 shadow-soft"
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <PiChatCircleTextLight className="h-5 w-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-ink-800">
          Új bejelentés
        </span>
        <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-red-400" />
      </Link>

      {/* Legutóbbi bejelentéseim — csak a saját korábbi bejelentések
          listájára (/user/bejelentesek) mutat, egyetlen összegző sorként. */}
      <Link
        to="/user/bejelentesek"
        className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-soft"
      >
        <span className="text-sm text-ink-500">
          {sajatBejelentesek.length === 0
            ? "Nincs bejelentésed"
            : `${sajatBejelentesek.length} legutóbbi bejelentésed`}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-brand-600">
          Megnyitás
          <PiCaretRightLight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
