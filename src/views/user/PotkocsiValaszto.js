import React, { useEffect, useMemo, useState } from "react";
import { PiMagnifyingGlassLight, PiTruckTrailerLight, PiCheckCircleFill, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import QrScanButton from "components/UI/QrScanButton.js";
import Spinner from "components/UI/Spinner.js";

const FILTERS = [
  { key: "mind", label: "Mind" },
  { key: "szabad", label: "Szabad" },
  { key: "uton", label: "Úton" },
  { key: "szervizben", label: "Szervizben" },
];

const ALLAPOT_TONE = {
  szabad: "bg-emerald-50 text-emerald-700",
  uton: "bg-brand-50 text-brand-700",
  szervizben: "bg-red-50 text-red-600",
};
const ALLAPOT_LABEL = { szabad: "Szabad", uton: "Úton", szervizben: "Szervizben" };

export default function PotkocsiValaszto() {
  const [user, setUser] = useState(null);
  const [potkocsik, setPotkocsik] = useState([]);
  const [pendingKerelem, setPendingKerelem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("mind");

  const loadPending = (soforId) => {
    fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: soforId }).then((result) => {
      if (result?.success) {
        setPendingKerelem((result.kerelmek || []).find((k) => k.tipus === "potkocsi") || null);
      }
    });
  };

  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem("user"));
    setUser(userData);
    // A sessionStorage-beli user.aktiv_potkocsi elavult lehet, ha
    // időközben egy korábbi kérést jóváhagytak.
    fetchAction("getSajatSofor", { id: userData.id }).then((result) => {
      if (result?.success && result.user) {
        const merged = { ...userData, ...result.user };
        sessionStorage.setItem("user", JSON.stringify(merged));
        setUser(merged);
      }
    });
    fetchAction("getPotkocsik", { id: userData.admin }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
      setLoading(false);
    });
    loadPending(userData.id);
  }, []);

  const filtered = useMemo(() => {
    return potkocsik.filter((p) => {
      if (filter !== "mind" && p.allapot !== filter) return false;
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        (p.rendszam || "").toLowerCase().includes(term) ||
        (p.tipus || "").toLowerCase().includes(term)
      );
    });
  }, [potkocsik, filter, search]);

  const request = async (potkocsi) => {
    if (String(potkocsi.id) === String(user?.aktiv_potkocsi)) return;
    setSaving(true);
    const result = await fetchAction("requestJarmuValtas", {
      admin: user.admin,
      sofor_id: user.id,
      tipus: "potkocsi",
      jarmu_id: potkocsi.id,
    });
    setSaving(false);
    if (result?.success) {
      toast.success(`Kérés elküldve: ${potkocsi.rendszam} — várj az admin jóváhagyására.`);
      loadPending(user.id);
    } else {
      toast.error(result?.message || "Nem sikerült elküldeni a kérést.");
    }
  };

  const withdraw = async () => {
    if (!pendingKerelem) return;
    const result = await fetchAction("visszavonJarmuValtas", { id: pendingKerelem.id });
    if (result?.success) {
      toast.success("Kérés visszavonva.");
      setPendingKerelem(null);
    }
  };

  const handleQr = (value) => {
    const match = potkocsik.find(
      (p) => (p.rendszam || "").toLowerCase().replace(/\s/g, "") === value.toLowerCase().replace(/\s/g, ""),
    );
    if (match) {
      request(match);
    } else {
      toast.error(`Nincs "${value}" rendszámú pótkocsi.`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Pótkocsi kiválasztása" />

      {pendingKerelem && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <PiClockLight className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">
            Kéréd jóváhagyásra vár: <span className="font-bold">{pendingKerelem.jarmu_rendszam}</span>
          </p>
          <button type="button" onClick={withdraw} className="text-xs font-bold text-amber-700 underline">
            Visszavonás
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5">
          <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rendszám vagy típus keresése"
            className="w-full bg-transparent text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
          />
        </div>
        <QrScanButton onResult={handleQr} label="Pótkocsi QR-kód beolvasása" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
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

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
          Nincs a szűrésnek megfelelő pótkocsi.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => {
            const active = String(p.id) === String(user?.aktiv_potkocsi);
            const requested = String(p.id) === String(pendingKerelem?.jarmu_id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={saving || active}
                onClick={() => request(p)}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-soft transition-colors duration-150 disabled:opacity-60 ${
                  active ? "border-brand-300 ring-1 ring-brand-200" : requested ? "border-amber-300" : "border-ink-100"
                }`}
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-ink-500">
                  <PiTruckTrailerLight className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-bold text-ink-900">{p.rendszam}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {p.tipus || "—"}
                    {p.aktualis_km ? ` · ${Number(p.aktualis_km).toLocaleString("hu-HU")} km` : ""}
                  </span>
                </span>
                {active ? (
                  <PiCheckCircleFill className="h-6 w-6 flex-shrink-0 text-brand-500" />
                ) : requested ? (
                  <span className="flex-shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    Kérve
                  </span>
                ) : (
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      ALLAPOT_TONE[p.allapot] || "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {ALLAPOT_LABEL[p.allapot] || p.allapot}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
