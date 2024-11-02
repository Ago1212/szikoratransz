import React from "react";

// components
import CardStats from "components/Cards/CardStats";
import CardCalender from "components/Cards/CardCalender";

export default function Dashboard() {
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-6/12 xl:w-3/12 px-4">
          <CardStats
            statSubtitle="Kamionok"
            statTitle="4"
            statArrow="up"
            statPercent="3.48"
            statPercentColor="text-emerald-500"
            statDescripiron=""
            statIconName="fas fa-truck"
            statIconColor="bg-red-500"
          />
        </div>
        <div className="w-full lg:w-6/12 xl:w-3/12 px-4">
          <CardStats
            statSubtitle="Sofőrök"
            statTitle="10"
            statArrow="down"
            statPercent="1.10"
            statPercentColor="text-orange-500"
            statDescripiron=""
            statIconName="fas fa-users"
            statIconColor="bg-pink-500"
          />
        </div>
        <div className="w-full lg:w-6/12 xl:w-3/12 px-4">
          <CardStats
            statSubtitle="Hónapban lejáró határidők"
            statTitle="10"
            statArrow="down"
            statPercent="1.10"
            statPercentColor="text-orange-500"
            statDescripiron=""
            statIconName="fas fa-calendar-days"
            statIconColor="bg-pink-500"
          />
        </div>
      </div>
      <div className="w-full mb-12 px-4 pt-8"> {/* Add padding-top here */}
        <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-blueGray-100 border-0">
          <CardCalender/>
        </div>
      </div>
    </>
  );
}
