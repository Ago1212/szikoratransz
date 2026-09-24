import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import {
  PiBellLight,
  PiTruckLight,
  PiWarningCircleLight,
  PiChatCircleTextLight,
  PiCaretRightLight,
  PiClipboardTextLight,
  PiMapTrifoldLight,
  PiCameraLight,
  PiPhoneLight,
  PiCheckCircleLight,
  PiXCircleLight,
  PiWifiSlashLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { useSajatErtesitesek, latottErtesitesek } from "utils/useSajatErtesitesek.js";
import { kovetkezoFuvar, fuvarKezdoDatum, utvonalUrl } from "utils/fuvarIdo";
import { formatDatumRovid, napokMaihoz } from "utils/formatDatum";
import { fuvarDokumentumokFeltoltese } from "utils/fuvarDokumentumFeltoltes.js";
import { offlineCimke } from "utils/soforCache";

const NAP_NEVEK = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
const HONAP_NEVEK = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function DashboardVaz() {
  const blokk = "animate-pulse rounded bg-slate-200 motion-reduce:animate-none";
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Betöltés">
      <div className={`h-10 w-40 ${blokk}`} />
      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <div className={`h-4 w-24 ${blokk}`} />
        <div className={`mt-3 h-6 w-3/4 ${blokk}`} />
        <div className={`mt-2 h-4 w-1/2 ${blokk}`} />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className={`h-14 ${blokk}`} />
          <div className={`h-14 ${blokk}`} />
        </div>
      </div>
      <div className={`h-16 rounded-2xl ${blokk}`} />
    </div>
  );
}

function KovetkezoFuvarKartya({ fuvar, tobbiSzam, diszpecser, onOpen, onFeltoltve }) {
  const [feltoltes, setFeltoltes] = useState(false);
  const kezdo = fuvarKezdoDatum(fuvar);
  const napok = napokMaihoz(kezdo);
  const url = utvonalUrl(fuvar);
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam;
  const cimke =
    napok === null ? "Következő fuvar" : napok < 0 ? "Folyamatban lévő fuvar" : napok === 0 ? "Mai fuvar" : napok === 1 ? "Holnapi fuvar" : "Következő fuvar";

  const handleFoto = async (e) => {
    const fajlok = Array.from(e.target.files || []);
    e.target.value = "";
    if (fajlok.length === 0) return;
    setFeltoltes(true);
    try {
      const { sikeres, sorba } = await fuvarDokumentumokFeltoltese(fuvar.id, "menetlevel", fajlok);
      if (sikeres > 0 || sorba > 0) onFeltoltve();
    } finally {
      setFeltoltes(false);
    }
  };

  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-soft" aria-label={cimke}>
      <button type="button" onClick={() => onOpen(fuvar)} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">{cimke}</span>
          {kezdo && (
            <span
              className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                napok === 0 ? "bg-brand-600 text-white" : napok < 0 ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"
              }`}
            >
              {kezdo === fuvar.felrakas_datuma ? "Felrakás" : "Lerakás"}: {formatDatumRovid(kezdo)}
            </span>
          )}
        </div>
        <p className="mt-2 text-lg font-bold leading-snug text-ink-900">
          {fuvar.felrako_ceg || "—"} → {fuvar.lerako_ceg || "—"}
        </p>
        {(fuvar.felrako_cim || fuvar.lerako_cim) && (
          <p className="mt-0.5 truncate text-sm text-ink-500">{[fuvar.felrako_cim, fuvar.lerako_cim].filter(Boolean).join(" → ")}</p>
        )}
        <p className="mt-1 flex items-center justify-between gap-2 text-sm text-ink-600">
          <span className="truncate">{[jarmu, fuvar.megbizo_nev].filter(Boolean).join(" · ") || "Részletek"}</span>
          <span className="flex flex-shrink-0 items-center font-semibold text-brand-600">
            Részletek <PiCaretRightLight className="h-4 w-4" />
          </span>
        </p>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-brand-600 text-base font-semibold text-white active:bg-brand-700"
          >
            <PiMapTrifoldLight className="h-6 w-6" /> Útvonal
          </a>
        ) : (
          <span className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-slate-100 px-2 text-center text-sm text-ink-500">
            Nincs cím az útvonalhoz
          </span>
        )}
        <label
          className={`flex min-h-[3.5rem] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-brand-50 text-base font-semibold text-brand-700 active:bg-brand-100 ${
            feltoltes ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {feltoltes ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <PiCameraLight className="h-6 w-6" />
          )}
          {feltoltes ? "Feltöltés…" : "Menetlevél"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} disabled={feltoltes} />
        </label>
      </div>
      {diszpecser?.phone && (
        <a
          href={`tel:${diszpecser.phone.replace(/[^\d+]/g, "")}`}
          className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink-700 active:bg-slate-100"
        >
          <PiPhoneLight className="h-5 w-5 text-brand-600" /> Diszpécser hívása
        </a>
      )}
      {tobbiSzam > 0 && (
        <Link
          to="/user/fuvarok"
          className="mt-1 flex min-h-11 items-center justify-center gap-1 border-t border-ink-100 pt-2 text-sm font-semibold text-brand-700"
        >
          +{tobbiSzam} további aktív fuvar <PiCaretRightLight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

function TeendoSor({ to, icon: Icon, tone, cim, leiras }) {
  const tonusok = {
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    info: "bg-brand-50 text-brand-600",
    success: "bg-emerald-50 text-emerald-600",
  };
  return (
    <Link to={to} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2.5 active:bg-slate-50">
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${tonusok[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{cim}</span>
        {leiras && <span className="block truncate text-sm text-ink-500">{leiras}</span>}
      </span>
      <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
    </Link>
  );
}

export default function UserDashboard() {
  const history = useHistory();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [jarmuvek, setJarmuvek] = useState({ kamion: null, potkocsi: null, furgon: null });
  const [kerelmek, setKerelmek] = useState([]);
  const [diszpecser, setDiszpecser] = useState(null);
  const utolsoFrissites = useRef(Date.now());
  const { lejaratok, fuvarok, bejelentesValaszok, jarmuValtasok, ujSzam, loading, offlineIdo, frissit } = useSajatErtesitesek();

  const jarmuvekBetoltese = useCallback(async () => {
    const userData = JSON.parse(localStorage.getItem("user") || "null");
    if (!userData) return;
    const [freshRes, kamionRes, potkocsiRes, furgonRes, kerelemRes] = await Promise.all([
      fetchAction("getSajatSofor", { id: userData.id }),
      fetchAction("getKamionok", { id: userData.admin }),
      fetchAction("getPotkocsik", { id: userData.admin }),
      fetchAction("getFurgonok", { id: userData.admin }),
      fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
    ]);
    const friss = freshRes?.success && freshRes.user ? { ...userData, ...freshRes.user } : userData;
    if (freshRes?.success && freshRes.user) {
      try {
        localStorage.setItem("user", JSON.stringify(friss));
      } catch (e) {
        // localStorage nem elérhető
      }
      setUser(friss);
    }
    setJarmuvek({
      kamion: (kamionRes?.kamionok || []).find((k) => String(k.id) === String(friss.kamion)) || null,
      potkocsi: (potkocsiRes?.potkocsik || []).find((p) => String(p.id) === String(friss.aktiv_potkocsi)) || null,
      furgon: (furgonRes?.furgonok || []).find((f) => String(f.id) === String(friss.furgon)) || null,
    });
    if (kerelemRes?.success) setKerelmek(kerelemRes.kerelmek || []);
  }, []);

  useEffect(() => {
    if (!user) {
      history.push("/auth/login");
      return;
    }
    jarmuvekBetoltese();
    fetchAction("getAdminElerhetoseg", { id: user.admin }).then((result) => {
      if (result?.success && result.phone) setDiszpecser({ name: result.name, phone: result.phone });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lathatosag = () => {
      if (document.visibilityState !== "visible" || Date.now() - utolsoFrissites.current < 60000) return;
      utolsoFrissites.current = Date.now();
      frissit();
      jarmuvekBetoltese();
    };
    document.addEventListener("visibilitychange", lathatosag);
    return () => document.removeEventListener("visibilitychange", lathatosag);
  }, [frissit, jarmuvekBetoltese]);

  if (!user) return null;
  if (loading) return <DashboardVaz />;

  const kovetkezo = kovetkezoFuvar(fuvarok);
  const latott = latottErtesitesek(user.id);
  const ujValaszok = bejelentesValaszok.filter((b) => !latott.has(`bej-${b.id}-${b.statusz}-${b.admin_valasz ? 1 : 0}`));
  const ujDontesek = jarmuValtasok.filter((k) => !latott.has(`jv-${k.id}`));

  const nevReszek = (user.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nevReszek[nevReszek.length - 1] || "";
  const ma = new Date();

  const jarmuSzoveg = [
    jarmuvek.kamion?.rendszam,
    jarmuvek.potkocsi?.rendszam && `pótkocsi ${jarmuvek.potkocsi.rendszam}`,
    jarmuvek.furgon?.rendszam && `furgon ${jarmuvek.furgon.rendszam}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const openFuvar = (f) => history.push(`/user/fuvarReszletek?id=${f.id}`, { data: f });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-500">
            {NAP_NEVEK[ma.getDay()]}, {HONAP_NEVEK[ma.getMonth()]} {ma.getDate()}.
          </p>
          <h1 className="font-display text-2xl font-bold text-brand-900">Szia, {firstName || user.name}!</h1>
        </div>
        <Link
          to="/user/ertesitesek"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-600 shadow-soft md:hidden"
          aria-label={ujSzam > 0 ? `Értesítések (${ujSzam} új)` : "Értesítések"}
        >
          <PiBellLight className="h-6 w-6" />
          {ujSzam > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {ujSzam > 9 ? "9+" : ujSzam}
            </span>
          )}
        </Link>
      </div>

      {offlineIdo && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm text-white">
          <PiWifiSlashLight className="h-4 w-4 flex-shrink-0" />
          {offlineCimke(offlineIdo)}
        </p>
      )}

      {kovetkezo ? (
        <KovetkezoFuvarKartya
          fuvar={kovetkezo}
          tobbiSzam={fuvarok.length - 1}
          diszpecser={diszpecser}
          onOpen={openFuvar}
          onFeltoltve={frissit}
        />
      ) : (
        <section className="flex flex-col items-center gap-2 rounded-3xl border border-ink-100 bg-white p-6 text-center shadow-soft">
          <PiClipboardTextLight className="h-9 w-9 text-ink-400" />
          <p className="text-base font-semibold text-ink-800">Nincs aktív fuvarod</p>
          <p className="text-sm text-ink-500">Ha a diszpécser kioszt egy fuvart, itt jelenik meg, és értesítést kapsz róla.</p>
          {diszpecser?.phone && (
            <a
              href={`tel:${diszpecser.phone.replace(/[^\d+]/g, "")}`}
              className="mt-1 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 active:bg-brand-50"
            >
              <PiPhoneLight className="h-5 w-5" /> Diszpécser hívása
            </a>
          )}
        </section>
      )}

      {(lejaratok.length > 0 || ujValaszok.length > 0 || ujDontesek.length > 0) && (
        <section aria-label="Teendők">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Teendők</h2>
          <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            {lejaratok.map((d) => (
              <TeendoSor
                key={d.key}
                to="/user/profil"
                icon={PiWarningCircleLight}
                tone={d.status === "expired" ? "danger" : "warning"}
                cim={`${d.label} ${d.status === "expired" ? "lejárt" : d.days === 0 ? "ma lejár" : `${d.days} nap múlva lejár`}`}
                leiras={d.status === "expired" ? "Intézd a pótlását, és frissítsd a profilodban" : "Frissítsd a profilodban, ha megújítottad"}
              />
            ))}
            {ujValaszok.map((b) => (
              <TeendoSor
                key={b.id}
                to="/user/bejelentesek"
                icon={PiChatCircleTextLight}
                tone="info"
                cim={b.admin_valasz ? `Válasz érkezett: ${b.cim}` : `Bejelentésed: ${b.statusz === "lezart" ? "lezárva" : "folyamatban"}`}
                leiras={b.admin_valasz || null}
              />
            ))}
            {ujDontesek.map((k) => (
              <TeendoSor
                key={k.id}
                to="/user/ertesitesek"
                icon={k.allapot === "jovahagyva" ? PiCheckCircleLight : PiXCircleLight}
                tone={k.allapot === "jovahagyva" ? "success" : "danger"}
                cim={`Járműváltás ${k.allapot === "jovahagyva" ? "jóváhagyva" : "elutasítva"}`}
                leiras={k.jarmu_rendszam || null}
              />
            ))}
          </div>
        </section>
      )}

      <Link
        to="/user/jarmu-valaszto"
        className="flex min-h-[3.5rem] items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-soft active:bg-slate-50"
      >
        <PiTruckLight className="h-6 w-6 flex-shrink-0 text-ink-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-500">Járműved</span>
          <span className="block truncate text-base font-semibold text-ink-900">{jarmuSzoveg || "Nincs kiválasztva"}</span>
          {kerelmek.length > 0 && (
            <span className="block truncate text-sm font-semibold text-amber-700">
              Jóváhagyásra vár: {kerelmek.map((k) => k.jarmu_rendszam).filter(Boolean).join(", ")}
            </span>
          )}
        </span>
        <span className="flex flex-shrink-0 items-center text-sm font-semibold text-brand-600">
          Csere <PiCaretRightLight className="h-4 w-4" />
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/user/potkocsi-valaszto"
          className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink-100"
        >
          Pótkocsi csere
        </Link>
        <Link
          to="/user/furgon-valaszto"
          className="flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink-100"
        >
          Furgon csere
        </Link>
      </div>

      <Link
        to="/user/bejelentesek"
        className="flex min-h-[3.25rem] items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 shadow-soft active:bg-slate-50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-700">
          <PiChatCircleTextLight className="h-5 w-5 text-ink-500" /> Bejelentéseim
        </span>
        <PiCaretRightLight className="h-4 w-4 text-ink-400" />
      </Link>
    </div>
  );
}
