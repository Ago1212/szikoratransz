import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/hu";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { fetchAction } from "utils/fetchAction";
//import "./CustomCalander.css"; // Egyéni CSS fájl

// Hozd létre a localizer-t
moment.locale("hu"); // Állítsd be a locale-t magyarra
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
          start: new Date(event.start), // start dátum átalakítása Date objektummá
          end: new Date(event.end), // end dátum átalakítása Date objektummá
        }));
        setEsemenyek(formattedEvents || []);
      } else {
        console.error("Error fetching stats:", result.message);
      }
    };

    fetchData();
  }, []);
  return (
    // Itt a return utasítás
    <div>
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
          previous: "<",
          next: ">",
          month: "Hónap",
          week: "Hét",
          day: "Nap",
          agenda: "Lista",
          date: "Dátum",
        }}
      />
    </div>
  );
}
