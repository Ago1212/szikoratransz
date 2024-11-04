import {React} from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/hu';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Hozd létre a localizer-t
moment.locale('hu'); // Állítsd be a locale-t magyarra
const localizer = momentLocalizer(moment);

// Példa események
const events = [
  {
    start: new Date(2024, 10, 5), // 2024. november 5.
    end: new Date(2024, 10, 5),
    title: 'Esemény 1',
  },{
    start: new Date(2024, 10, 10), // 2024. november 10.
    end: new Date(2024, 10, 10),
    title: 'Esemény 2',
  },
];

export default function CardCalender() {
  return ( // Itt a return utasítás
    <div >
      <Calendar
        views={['month','agenda','day','week']}
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 700 }}
        defaultDate={new Date()}
        defaultView="month"
        popup
        messages={{
          today: 'Ma',
          previous: '<',
          next: '>',
          month: 'Hónap',
          week: 'Hét',
          day: 'Nap',
          agenda: 'Lista',
          date: 'Dátum',
        }}
      />
    </div>
  );
}
