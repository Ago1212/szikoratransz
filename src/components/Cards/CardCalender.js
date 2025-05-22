import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/hu";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { fetchAction } from "utils/fetchAction";

// Lokalizáció beállítása
moment.locale("hu");
const localizer = momentLocalizer(moment);

export default function CardCalender() {
  const [esemenyek, setEsemenyek] = useState([]);

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
        setEsemenyek(formattedEvents || []);
      } else {
        console.error("Hiba az események lekérésekor:", result.message);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-4">
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <Calendar
          views={["month", "agenda", "day", "week"]}
          localizer={localizer}
          events={esemenyek}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 700 }}
          defaultDate={new Date()}
          defaultView="month"
          popup
          messages={{
            today: "Ma",
            previous: "Előző",
            next: "Következő",
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
      </div>
    </div>
  );
}
