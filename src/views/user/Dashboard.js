import React, { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import {
  PiBellLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiGasPumpLight,
  PiPhoneLight,
  PiCaretRightLight,
  PiMapPinLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import {
  DOCUMENT_FIELDS,
  getDocumentStatus,
  daysUntil,
} from "utils/documentStatus.js";

const STATUSZ_TONE = { uj: "warning", folyamatban: "info", lezart: "success" };
const STATUSZ_LABEL = {
  uj: "Új",
  folyamatban: "Folyamatban",
  lezart: "Lezárva",
};

// A "Bejelentés" csempe szándékosan NINCS itt — a BottomNav középső,
// mindig piros FAB-ja már ugyanoda vezet, egy második, azonos célú
// csempe a Gyors műveletek rácsban felesleges duplikáció lenne.
const quickActions = [
  {
    to: "/user/jarmu-valaszto",
    icon: PiTruckLight,
    label: "Kamion",
    tone: "brand",
  },
  {
    to: "/user/potkocsi-valaszto",
    icon: PiTruckTrailerLight,
    label: "Pótkocsi",
    tone: "brand",
  },
  {
    to: "/user/furgon-valaszto",
    icon: PiVanLight,
    label: "Furgon",
    tone: "brand",
  },
  {
    to: "/user/helyszinek",
    icon: PiMapPinLight,
    label: "Helyszínek",
    tone: "brand",
  },
  {
    to: "/user/tankolas",
    icon: PiGasPumpLight,
    label: "Tankolás",
    tone: "brand",
  },
];

const TILE_TONE = {
  brand: "bg-brand-50 text-brand-600",
  danger: "bg-red-50 text-red-600",
};

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
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

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
        adminRes,
        kerelemRes,
        elbiraltRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getAdminElerhetoseg", { id: userData.admin }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
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
      if (adminRes?.success) setAdmin(adminRes);
      if (kerelemRes?.success) setKerelmek(kerelemRes.kerelmek || []);
      if (elbiraltRes?.success)
        setElbiraltJarmuValtasok(elbiraltRes.kerelmek || []);
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

  const firstName = (user.name || "").split(" ")[0];

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

      {/* Aktív jármű */}
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
              Válassz kamiont
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
              Válassz pótkocsit
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
              Válassz furgont
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

      {/* Gyors műveletek */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Gyors műveletek
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white py-4 text-center shadow-soft"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full ${TILE_TONE[action.tone]}`}
              >
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-ink-700">
                {action.label}
              </span>
            </Link>
          ))}
          {admin?.phone ? (
            <a
              href={`tel:${admin.phone}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white py-4 text-center shadow-soft"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <PiPhoneLight className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-ink-700">
                Diszpécser
              </span>
            </a>
          ) : null}
        </div>
      </div>

      {/* Legutóbbi bejelentéseim */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Legutóbbi bejelentéseim
          </h2>
          <Link
            to="/user/bejelentesek"
            className="text-xs font-semibold text-brand-600"
          >
            Összes
          </Link>
        </div>
        {sajatBejelentesek.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm text-ink-400 shadow-soft">
            Még nincs bejelentésed.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sajatBejelentesek.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {b.cim}
                  </p>
                  <StatusBadge tone={STATUSZ_TONE[b.statusz] || "neutral"}>
                    {STATUSZ_LABEL[b.statusz] || b.statusz}
                  </StatusBadge>
                </div>
                <div className="mt-1">
                  <span className="text-xs text-ink-400">
                    {(b.bejelentve || "").slice(0, 16).replace("T", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
