import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
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

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getEsemenyek", { id: user.id });
      if (result.success) {
        const formattedEvents = result.data.map((event) => ({
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

  return (
    <div className="calendar-container">
      <div className="calendar-card">
        <Calendar
          views={["month", "agenda", "day", "week"]}
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 700 }}
          defaultDate={new Date()}
          defaultView="month"
          popup
          onSelectEvent={handleEventClick}
          messages={{
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
          }}
        />

        {isOpen && <EventModal event={selectedEvent} onClose={handleClose} />}
      </div>
    </div>
  );
}
