import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "moment/locale/hu";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { useMediaQuery } from "react-responsive";
import { PiPackageLight, PiCalendarCheckLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import Modal from "components/UI/Modal.js";
import StatusBadge from "components/UI/StatusBadge.js";

moment.locale("hu");
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const STATUSZ_TONE = { tervezett: "neutral", folyamatban: "info", lezart: "success", storno: "danger" };
const STATUSZ_LABEL = { tervezett: "Tervezett", folyamatban: "Folyamatban", lezart: "Lezárt", storno: "Sztornó" };
const STATUSZ_SZIN = { tervezett: "#94a3b8", folyamatban: "#2F4DE0", lezart: "#10b981", storno: "#ef4444" };

const calendarMessages = {
  today: "Ma",
  previous: "◄",
  next: "►",
  week: "Hét",
  day: "Nap",
  date: "Dátum",
  time: "Idő",
  event: "Fuvar",
  noEventsInRange: "Nincs beosztott fuvar ebben az időszakban.",
  showMore: (total) => `+${total} további`,
};

const toDbDate = (d) => moment(d).format("YYYY-MM-DD");

export default function Fuvartervezo() {
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const [kamionok, setKamionok] = useState([]);
  const [fuvarok, setFuvarok] = useState([]);
  const [range, setRange] = useState(() => ({
    tol: moment().subtract(7, "days").format("YYYY-MM-DD"),
    ig: moment().add(60, "days").format("YYYY-MM-DD"),
  }));
  const [draggedFuvar, setDraggedFuvar] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchAction("getKamionRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFuvarok = useCallback(() => {
    fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      datumTol: range.tol,
      datumIg: range.ig,
    }).then((result) => {
      if (result?.success) setFuvarok(result.fuvarok || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.tol, range.ig]);

  useEffect(() => {
    loadFuvarok();
  }, [loadFuvarok]);

  const events = useMemo(
    () =>
      fuvarok
        .filter((f) => f.kamion_id && f.felrakas_datum)
        .map((f) => ({
          id: f.id,
          title: `${f.felrakas_cim} → ${f.lerakas_cim}`,
          start: new Date(f.felrakas_datum),
          end: new Date(f.lerakas_datum || f.felrakas_datum),
          resourceId: f.kamion_id,
          raw: f,
        })),
    [fuvarok]
  );

  const beosztatlanok = useMemo(
    () => fuvarok.filter((f) => !f.kamion_id && f.statusz !== "lezart" && f.statusz !== "storno"),
    [fuvarok]
  );

  const updateBeosztas = (id, kamion_id, felrakas_datum, lerakas_datum) => {
    // Optimista frissítés — a húzás azonnal "megáll" ott, ahova ejtettük,
    // nem várja meg a szerver válaszát, utána a háttérben szinkronizál.
    setFuvarok((prev) =>
      prev.map((f) => (f.id === id ? { ...f, kamion_id, felrakas_datum, lerakas_datum } : f))
    );
    fetchAction("updateFuvarBeosztas", {
      id,
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      kamion_id,
      felrakas_datum,
      lerakas_datum,
    }).then((result) => {
      if (!result?.success) loadFuvarok();
    });
  };

  const handleEventDrop = ({ event, start, end, resourceId }) => {
    updateBeosztas(event.id, resourceId ?? event.resourceId, toDbDate(start), toDbDate(end));
  };

  const handleEventResize = ({ event, start, end }) => {
    updateBeosztas(event.id, event.resourceId, toDbDate(start), toDbDate(end));
  };

  const handleDropFromOutside = ({ start, resource }) => {
    if (!draggedFuvar || !resource) return;
    const felrakas = toDbDate(start);
    let lerakas = felrakas;
    if (draggedFuvar.felrakas_datum && draggedFuvar.lerakas_datum) {
      const napok = moment(draggedFuvar.lerakas_datum).diff(moment(draggedFuvar.felrakas_datum), "days");
      lerakas = moment(start)
        .add(Math.max(napok, 0), "days")
        .format("YYYY-MM-DD");
    }
    updateBeosztas(draggedFuvar.id, resource, felrakas, lerakas);
    setDraggedFuvar(null);
  };

  const eventPropGetter = (event) => ({
    style: {
      backgroundColor: STATUSZ_SZIN[event.raw?.statusz] || STATUSZ_SZIN.tervezett,
      borderColor: "transparent",
    },
  });

  if (isMobile) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <PageHeader eyebrow="Járművek" title="Fuvartervező" className="mb-0" />
        <div className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-ink-100">
          <PiCalendarCheckLight className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-3 text-sm text-ink-500">
            A Fuvartervező (húzd-és-ejtsd beosztás) nagyobb, asztali képernyőre készült. Nyisd meg
            számítógépen, vagy kezeld a fuvarokat a{" "}
            <button
              type="button"
              className="font-semibold text-brand-600 underline"
              onClick={() => history.push("/admin/fuvarok")}
            >
              Fuvarok listában
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PageHeader eyebrow="Járművek" title="Fuvartervező" className="mb-0" />

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Beosztatlan fuvarok
          </h3>
          {beosztatlanok.length === 0 ? (
            <p className="text-sm text-ink-400">Nincs beosztatlan fuvar.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {beosztatlanok.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => setDraggedFuvar(f)}
                  onDragEnd={() => setDraggedFuvar(null)}
                  className="cursor-grab rounded-xl border border-ink-100 bg-slate-50 p-2.5 text-xs active:cursor-grabbing"
                  title="Húzd egy kamion oszlopára a beosztáshoz"
                >
                  <p className="font-semibold text-ink-700">
                    {f.felrakas_cim} → {f.lerakas_cim}
                  </p>
                  {f.felrakas_datum && <p className="text-ink-400">{f.felrakas_datum}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100">
          <div style={{ height: "70vh", minWidth: kamionok.length > 3 ? `${kamionok.length * 220}px` : undefined }}>
            <DnDCalendar
              localizer={localizer}
              events={events}
              resources={kamionok}
              resourceIdAccessor="id"
              resourceTitleAccessor="rendszam"
              startAccessor="start"
              endAccessor="end"
              views={["week", "day"]}
              defaultView="week"
              messages={calendarMessages}
              onRangeChange={(r) => {
                const napok = Array.isArray(r) ? r : [r.start, r.end];
                setRange({ tol: toDbDate(napok[0]), ig: toDbDate(napok[napok.length - 1]) });
              }}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onDropFromOutside={handleDropFromOutside}
              dragFromOutsideItem={
                draggedFuvar ? () => ({ title: draggedFuvar.felrakas_cim, start: new Date(), end: new Date() }) : null
              }
              onSelectEvent={(event) => setSelectedEvent(event)}
              eventPropGetter={eventPropGetter}
              style={{ height: "100%" }}
            />
          </div>
        </div>
      </div>

      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Fuvar részletei">
        {selectedEvent && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {selectedEvent.raw.felrakas_cim} → {selectedEvent.raw.lerakas_cim}
              </p>
              <p className="text-xs text-ink-500">
                {selectedEvent.raw.felrakas_datum} — {selectedEvent.raw.lerakas_datum || selectedEvent.raw.felrakas_datum}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-ink-500">
              {selectedEvent.raw.sofor_nev && <span>Sofőr: {selectedEvent.raw.sofor_nev}</span>}
              {selectedEvent.raw.dij && (
                <span>
                  Díj: {selectedEvent.raw.dij} {selectedEvent.raw.devizanem}
                </span>
              )}
            </div>
            <StatusBadge tone={STATUSZ_TONE[selectedEvent.raw.statusz] || "neutral"}>
              {STATUSZ_LABEL[selectedEvent.raw.statusz] || selectedEvent.raw.statusz}
            </StatusBadge>
            <button
              type="button"
              onClick={() => history.push("/admin/fuvarok")}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              <PiPackageLight className="h-4 w-4" />
              Megnyitás a Fuvarok között
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
