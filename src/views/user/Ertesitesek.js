import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PiWarningCircleLight, PiChatCircleTextLight, PiBellSlashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import { DOCUMENT_FIELDS, getDocumentStatus, getDocumentTone, daysUntil } from "utils/documentStatus.js";

export default function Ertesitesek() {
  const [loading, setLoading] = useState(true);
  const [dokumentumEsemenyek, setDokumentumEsemenyek] = useState([]);
  const [bejelentesEsemenyek, setBejelentesEsemenyek] = useState([]);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user"));

    const lejaratok = DOCUMENT_FIELDS.map((field) => ({
      ...field,
      status: getDocumentStatus(user[field.key]),
      days: daysUntil(user[field.key]),
    })).filter((d) => d.status === "expired" || d.status === "warning");
    setDokumentumEsemenyek(lejaratok);

    fetchAction("getBejelentesekSofor", { sofor_id: user.id }).then((result) => {
      if (result?.success) {
        const valaszolt = (result.bejelentesek || []).filter(
          (b) => b.statusz !== "uj" || b.admin_valasz,
        );
        setBejelentesEsemenyek(valaszolt.slice(0, 5));
      }
      setLoading(false);
    });
  }, []);

  const isEmpty = dokumentumEsemenyek.length === 0 && bejelentesEsemenyek.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Értesítések" back={false} />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiBellSlashLight className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-400">Nincs új értesítésed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dokumentumEsemenyek.map((d) => (
            <Link
              key={d.key}
              to="/user/profil"
              className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
            >
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  d.status === "expired" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                }`}
              >
                <PiWarningCircleLight className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{d.label}</p>
                <p className="text-xs text-ink-500">
                  {d.status === "expired" ? "Lejárt — pótlás szükséges" : `${d.days} nap múlva lejár`}
                </p>
              </div>
              <StatusBadge tone={getDocumentTone(d.status)}>
                {d.status === "expired" ? "Lejárt" : "Hamarosan"}
              </StatusBadge>
            </Link>
          ))}

          {bejelentesEsemenyek.map((b) => (
            <Link
              key={b.id}
              to="/user/bejelentesek"
              className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <PiChatCircleTextLight className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{b.cim}</p>
                <p className="truncate text-xs text-ink-500">
                  {b.statusz === "lezart" ? "Bejelentésed lezárva" : "Bejelentésed folyamatban van"}
                  {b.admin_valasz ? " — válasz érkezett" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
