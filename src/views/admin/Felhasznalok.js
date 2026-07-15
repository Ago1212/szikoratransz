import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiPlusLight,
  PiTrashLight,
  PiCrownSimpleLight,
  PiPencilSimpleLight,
  PiMagnifyingGlassLight,
  PiUserGearLight,
  PiIdentificationBadgeLight,
  PiSteeringWheelLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import FormField from "components/UI/FormField.js";
import Spinner from "components/UI/Spinner.js";

// A szerepkörök listája cégenként egyénileg bővíthető (ld. Jogosultsagok.js)
// — itt csak az 'admin' és a sofőr-koncepció ikonja fix, minden egyéni
// szerepkör ugyanazt az általános ikont kapja a sorban.
const ROLE_ICON = {
  admin: PiUserGearLight,
  sofor: PiSteeringWheelLight,
};

const FILTERS = [
  { key: "mind", label: "Mind" },
  { key: "csapattag", label: "Csapattagok" },
  { key: "sofor", label: "Sofőrök" },
];

// Egységes áttekintés a rendszerhez hozzáférő minden emberről —
// korábban ezt csak a Csapat és a Sofőrök oldal külön-külön mutatta,
// nem volt egy hely, ahol egyszerre látszik, ki fér hozzá összesen
// (ld. a felhasználókezelés-elemzés 02. és 09. pontját).
export default function Felhasznalok() {
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [csapattagok, setCsapattagok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [szerepkorok, setSzerepkorok] = useState([{ kulcs: "admin", nev: "Adminisztrátor" }]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("mind");

  const load = async () => {
    const [csapatRes, soforRes, szerepkorRes] = await Promise.all([
      fetchAction("getCsapattagok", { id: user.ceg_id }),
      fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }),
      fetchAction("getSzerepkorok", { id: user.ceg_id }),
    ]);
    if (csapatRes?.success) setCsapattagok(csapatRes.csapattagok || []);
    if (soforRes?.success) setSoforok(soforRes.soforok || []);
    if (szerepkorRes?.success) setSzerepkorok(szerepkorRes.szerepkorok || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combined = useMemo(() => {
    const csapatRows = csapattagok.map((c) => ({
      tipus: "csapattag",
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      szerepkor: c.szerepkor,
      ber: c.ber,
      isRoot: !c.tulajdonos_admin_id,
      isSelf: String(c.id) === String(user.id),
    }));
    const soforRows = soforok.map((s) => ({
      tipus: "sofor",
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      szerepkor: null,
      raw: s,
    }));
    return [...csapatRows, ...soforRows];
  }, [csapattagok, soforok, user.id]);

  const filtered = combined.filter((row) => {
    if (filter !== "mind" && row.tipus !== filter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      (row.name || "").toLowerCase().includes(term) ||
      (row.email || "").toLowerCase().includes(term)
    );
  });

  const handleSzerepkorChange = async (row, szerepkor) => {
    const result = await fetchAction("updateCsapattagSzerepkor", {
      id: row.id,
      ceg_id: user.ceg_id,
      szerepkor,
      kerelmezo_id: user.id,
    });
    if (result?.success) {
      toast.success("Szerepkör frissítve.");
      load();
    } else {
      toast.error(result?.message || "Módosítás sikertelen.");
    }
  };

  // Havi bérezés — kizárólag admin szerepkörnek látszik/szerkeszthető (ld.
  // sql/24.sql), inline mentéssel (elhagyáskor ment, nincs külön "Mentés"
  // gomb soronként — kevés, ritkán módosuló mezőnél ez egyszerűbb, mint
  // egy teljes szerkesztő-form nyitása egyetlen számhoz).
  const isOwnerAdmin = user.szerepkor === "admin";
  const handleBerBlur = async (row, value) => {
    const ujErtek = value.trim();
    if (ujErtek === String(row.ber ?? "")) return;
    const result = await fetchAction("updateCsapattagBer", {
      id: row.id,
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ber: ujErtek === "" ? null : ujErtek,
    });
    if (result?.success) {
      toast.success("Bérezés frissítve.");
      load();
    } else {
      toast.error(result?.message || "Módosítás sikertelen.");
    }
  };

  const handleDeleteCsapattag = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a csapattagot? A saját belépését elveszíti.")) return;
    const result = await fetchAction("deleteCsapattag", { id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Csapattag törölve.");
      load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const handleDeleteSofor = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a sofőrt?")) return;
    const result = await fetchAction("deleteSofor", { id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Sofőr törölve.");
      load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="Saját adatok"
        title="Felhasználók"
        action={
          <button
            type="button"
            onClick={() => history.push("/admin/felhasznalok/uj")}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
          >
            <PiPlusLight className="h-4 w-4" />
            Új felhasználó
          </button>
        }
      />

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500">
        Minden ember egy helyen, aki hozzáfér a rendszerhez — csapattagok (teljes admin-hozzáférés) és
        sofőrök (saját mobil felület) együtt.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5">
          <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Név vagy email keresése"
            className="w-full bg-transparent text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150 ${
                filter === f.key ? "bg-brand-600 text-white" : "bg-white text-ink-500 border border-ink-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-400 shadow-soft">
          Nincs a szűrésnek megfelelő felhasználó.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((row) => (
            <div
              key={`${row.tipus}-${row.id}`}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
            >
              {(() => {
                const RoleIcon =
                  row.tipus === "sofor" ? ROLE_ICON.sofor : ROLE_ICON[row.szerepkor] || PiIdentificationBadgeLight;
                return (
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <RoleIcon className="h-5 w-5" />
                  </span>
                );
              })()}
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink-900">{row.name}</p>
                  {row.tipus === "csapattag" && row.isRoot && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      <PiCrownSimpleLight className="h-3 w-3" />
                      Cégtulajdonos
                    </span>
                  )}
                  {row.tipus === "csapattag" && row.isSelf && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">Te</span>
                  )}
                  {row.tipus === "sofor" && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Sofőr
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-500">
                  {row.email}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </div>

              {/* Szerepkör-vezérlő + műveletek — mobilon (a fenti basis-full
                  miatt) mindig saját, teljes szélességű sorba kerül, jobbra
                  igazítva, hogy ne préselődjön a névvel egy 320px-es sorba. */}
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                {row.tipus === "csapattag" && isOwnerAdmin && (
                  <div className="w-32 flex-shrink-0">
                    <input
                      type="number"
                      defaultValue={row.ber ?? ""}
                      onBlur={(e) => handleBerBlur(row, e.target.value)}
                      placeholder="Havi bér"
                      title="Havi bérezés (Ft) — csak te látod"
                      className="w-full rounded-lg border border-ink-100 bg-slate-50 px-2.5 py-1.5 text-xs text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                )}
                {row.tipus === "csapattag" ? (
                  row.isRoot ? (
                    <span
                      className="w-44 flex-shrink-0 truncate rounded-lg bg-ink-50 px-3 py-1.5 text-center text-xs font-semibold text-ink-500"
                      title="A cégtulajdonos szerepköre fixen adminisztrátor, nem módosítható."
                    >
                      Adminisztrátor
                    </span>
                  ) : (
                    <FormField
                      as="select"
                      value={row.szerepkor || "admin"}
                      onChange={(e) => handleSzerepkorChange(row, e.target.value)}
                      className="w-44 flex-shrink-0"
                      inputClassName="text-xs py-1.5"
                    >
                      {szerepkorok.map((r) => (
                        <option key={r.kulcs} value={r.kulcs}>
                          {r.nev}
                        </option>
                      ))}
                    </FormField>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => history.push("/admin/soforForm", { data: row.raw })}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Szerkesztés"
                  >
                    <PiPencilSimpleLight className="h-5 w-5" />
                  </button>
                )}

                {row.tipus === "csapattag" && !row.isRoot && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCsapattag(row.id)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Törlés"
                  >
                    <PiTrashLight className="h-5 w-5" />
                  </button>
                )}
                {row.tipus === "sofor" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSofor(row.id)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Törlés"
                  >
                    <PiTrashLight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
