import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import { useMediaQuery } from "react-responsive";
import moment from "moment";
import "moment/locale/hu";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { fetchAction } from "utils/fetchAction";
import "./CustomCalander.css";

moment.locale("hu");
const localizer = momentLocalizer(moment);

const EventModal = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{event.title}</h3>
          <button onClick={onClose} className="close-button">
            &times;
          </button>
        </div>
        <div className="modal-content">
          <p>
            <strong>Kezdés:</strong>{" "}
            {moment(event.start).format("YYYY. MMMM D. HH:mm")}
          </p>
          <p>
            <strong>Befejezés:</strong>{" "}
            {moment(event.end).format("YYYY. MMMM D. HH:mm")}
          </p>
          {event.desc && (
            <div className="description">
              <strong>Leírás:</strong>
              <p>{event.desc}</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">
            Bezár
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CustomCalendar() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getEsemenyek", { id: user.id });
      if (result.success) {
        const formattedEvents = result.data
          .filter(
            (event) =>
              event.start !== "0000-00-00" && event.end !== "0000-00-00"
          ) // Szűrés érvénytelen dátumokra
          .map((event) => ({
            ...event,
            start: new Date(event.start),
            end: new Date(event.end),
          }));
        setEvents(formattedEvents || []);
      } else {
        console.error("Hiba az események lekérésekor:", result.message);
      }
    };

    fetchData();
  }, []);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSelectSlot = (slotInfo) => setSelectedDate(slotInfo.start);
  const handleDrillDown = (date) => setSelectedDate(date);

  const dayPropGetter = (date) =>
    moment(date).isSame(selectedDate, "day")
      ? { className: "rbc-day-selected" }
      : {};

  const dayEvents = events.filter((event) =>
    moment(event.start).isSame(selectedDate, "day")
  );

  const calendarMessages = {
    today: "Ma",
    previous: "◄",
    next: "►",
    month: "Hónap",
    week: "Hét",
    day: "Nap",
    agenda: "Lista",
    date: "Dátum",
    time: "Idő",
    event: "Esemény",
    noEventsInRange: "Nincs esemény az adott időszakban.",
    showMore: (total) => `+${total} további`,
  };

  if (isMobile) {
    return (
      <div className="calendar-container calendar-container--mobile">
        <div className="calendar-card calendar-card--mobile">
          <Calendar
            views={["month"]}
            defaultView="month"
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 320 }}
            defaultDate={new Date()}
            selectable="ignoreEvents"
            onSelectSlot={handleSelectSlot}
            onDrillDown={handleDrillDown}
            dayPropGetter={dayPropGetter}
            onSelectEvent={(event) => setSelectedDate(event.start)}
            messages={calendarMessages}
          />

          {/* Mobilon nincs felugró részletező form — a kiválasztott nap
              eseményeit kizárólag ez az alsó lista mutatja, akár a
              naptárban egy eseményre, akár egy napra koppintunk. */}
          <div className="mt-3 border-t border-ink-100 pt-3">
            <h4 className="mb-2 text-sm font-semibold text-brand-900">
              {moment(selectedDate).format("YYYY. MMMM D. (dddd)")}
            </h4>
            {dayEvents.length === 0 ? (
              <p className="rounded-xl bg-sand-50 px-3 py-4 text-center text-sm text-ink-400">
                Nincs esemény ezen a napon.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((event, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2.5 rounded-xl bg-sand-50 px-3 py-2.5"
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-700">
                      {event.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-card">
        <Calendar
          views={["month", "agenda", "day", "week"]}
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          defaultDate={new Date()}
          defaultView="month"
          popup
          onSelectEvent={handleEventClick}
          messages={calendarMessages}
        />

        {isOpen && <EventModal event={selectedEvent} onClose={handleClose} />}
      </div>
    </div>
  );
}
