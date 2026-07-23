import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiPlusLight,
  PiTrashLight,
  PiCrownSimpleLight,
  PiPencilSimpleLight,
  PiUserGearLight,
  PiIdentificationBadgeLight,
  PiSteeringWheelLight,
  PiUsersFourLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import FormField from "components/UI/FormField.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { confirmDialog } from "utils/confirm.js";

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
  const user = JSON.parse(localStorage.getItem("user"));
  const [csapattagok, setCsapattagok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [szerepkorok, setSzerepkorok] = useState([{ kulcs: "admin", nev: "Adminisztrátor" }]);
  const [loading, setLoading] = useState(true);
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

  // A szabadszavas keresést mostantól a DataTable saját, beépített
  // `searchable`-je végzi (ld. UX-audit — így ez az oldal is megkapja a
  // DataTable rendezés/lapozás/export képességét, amit korábban egy kézzel
  // épített kártyalista miatt nélkülözött), itt csak a típus-pill szerinti
  // szűrés marad.
  const filtered = combined.filter((row) => filter === "mind" || row.tipus === filter);

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
    if (!(await confirmDialog("Biztosan törlöd ezt a csapattagot? A saját belépését elveszíti."))) return;
    const result = await fetchAction("deleteCsapattag", { id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Csapattag törölve.");
      load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const handleDeleteSofor = async (id) => {
    if (!(await confirmDialog("Biztosan törlöd ezt a sofőrt?"))) return;
    const result = await fetchAction("deleteSofor", { id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Sofőr törölve.");
      load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  // UX-audit — korábban egy kézzel épített kártyalista volt (nincs
  // rendezés/lapozás/export), miközben ez egy hozzáférés-kezelő oldal,
  // ahol pont ezek hasznosak lennének egy nagyobb csapatnál. A megosztott
  // `DataTable`-re állítva a meglévő inline szerkesztés (bér/szerepkör)
  // megmarad, csak `render()`-be került.
  const columns = [
    {
      key: "name",
      label: "Név",
      sortable: true,
      render: (row) => {
        const RoleIcon =
          row.tipus === "sofor" ? ROLE_ICON.sofor : ROLE_ICON[row.szerepkor] || PiIdentificationBadgeLight;
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <RoleIcon className="h-4 w-4" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-ink-900 dark:text-ink-50">{row.name}</span>
              {row.tipus === "csapattag" && row.isRoot && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <PiCrownSimpleLight className="h-3 w-3" />
                  Cégtulajdonos
                </span>
              )}
              {row.tipus === "csapattag" && row.isSelf && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">Te</span>
              )}
              {row.tipus === "sofor" && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Sofőr
                </span>
              )}
            </div>
          </div>
        );
      },
      exportValue: (row) => row.name,
    },
    {
      key: "email",
      label: "Elérhetőség",
      sortable: true,
      render: (row) => (
        <span className="whitespace-normal">
          {row.email}
          {row.phone ? ` · ${row.phone}` : ""}
        </span>
      ),
      exportValue: (row) => [row.email, row.phone].filter(Boolean).join(" · "),
    },
    {
      key: "szerepkor",
      label: isOwnerAdmin ? "Szerepkör / Bér" : "Szerepkör",
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {row.tipus === "csapattag" && isOwnerAdmin && (
            <input
              type="number"
              defaultValue={row.ber ?? ""}
              onBlur={(e) => handleBerBlur(row, e.target.value)}
              placeholder="Havi bér"
              title="Havi bérezés (Ft) — csak te látod"
              className="w-28 rounded-lg border border-ink-100 bg-slate-50 px-2.5 py-1.5 text-xs text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-100"
            />
          )}
          {row.tipus === "csapattag" ? (
            row.isRoot ? (
              <span
                className="w-32 flex-shrink-0 truncate rounded-lg bg-ink-50 px-3 py-1.5 text-center text-xs font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400"
                title="A cégtulajdonos szerepköre fixen adminisztrátor, nem módosítható."
              >
                Adminisztrátor
              </span>
            ) : (
              <FormField
                as="select"
                id={`szerepkor-${row.id}`}
                value={row.szerepkor || "admin"}
                onChange={(e) => handleSzerepkorChange(row, e.target.value)}
                className="w-36 flex-shrink-0"
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
            <span className="text-xs text-ink-400 dark:text-ink-500">—</span>
          )}
        </div>
      ),
      exportValue: (row) =>
        row.tipus === "sofor"
          ? "Sofőr"
          : row.isRoot
            ? "Adminisztrátor"
            : szerepkorok.find((r) => r.kulcs === row.szerepkor)?.nev || row.szerepkor,
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.tipus === "sofor" && (
            <ActionIcon
              icon={<PiPencilSimpleLight />}
              onClick={() => history.push("/admin/soforForm", { data: row.raw })}
              title="Szerkesztés"
            />
          )}
          {row.tipus === "csapattag" && !row.isRoot && (
            <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDeleteCsapattag(row.id)} title="Törlés" />
          )}
          {row.tipus === "sofor" && (
            <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDeleteSofor(row.id)} title="Törlés" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="Rendszer"
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

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
        Minden ember egy helyen, aki hozzáfér a rendszerhez — csapattagok (teljes admin-hozzáférés) és
        sofőrök (saját mobil felület) együtt.
      </p>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150 ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-white text-ink-500 border border-ink-100 dark:bg-ink-900 dark:text-ink-400 dark:border-ink-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        icon={PiUsersFourLight}
        title="Csapattagok és sofőrök"
        columns={columns}
        rows={filtered}
        rowKey={(row) => `${row.tipus}-${row.id}`}
        loading={loading}
        exportFilename="felhasznalok"
        mobileTitleKey="name"
        emptyLabel="Nincs a szűrésnek megfelelő felhasználó"
        searchable
        searchPlaceholder="Név vagy email keresése..."
      />
    </div>
  );
}
