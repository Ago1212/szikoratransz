import React from "react";

// components
import CardStats from "components/Cards/CardStats";

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
          statDescripiron="Since last month"
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
          statDescripiron="Since yesterday"
          statIconName="fas fa-users"
          statIconColor="bg-pink-500"
        />
      </div>
    </div>
    </>
  );
}
