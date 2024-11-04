import React, { useEffect, useState } from "react";

// components
import CardStats from "components/Cards/CardStats";
import CardCalender from "components/Cards/CardCalender";
import { fetchAction } from "utils/fetchAction";

export default function Dashboard() {
  const [stats, setStats] = useState({
    soforok: 0,
    kamionok: 0,
    potkocsik: 0,
    hatarido: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      const userId = 1;
      const result = await fetchAction("getSum", { id: userId });
      if (result.success) {
        setStats({
          soforok: result.sofor || 0,
          kamionok: result.kamion || 0,
          potkocsik: result.potkocsi || 0,
          hatarido: result.hatarido || 0,
        });
      } else {
        console.error("Error fetching stats:", result.message);
      }
    };

    fetchData();
  }, []);
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-6/12 xl:w-3/12 px-4">
          <CardStats
            statSubtitle="Sofőrök"
            statTitle={stats.soforok.toString()}
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
            statSubtitle="Kamionok"
            statTitle={stats.kamionok.toString()}
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
            statSubtitle="Pótkocsik"
            statTitle={stats.potkocsik.toString()}
            statArrow="down"
            statPercent="1.10"
            statPercentColor="text-orange-500"
            statDescripiron=""
            statIconName="fas fa-trailer"
            statIconColor="bg-pink-500"
          />
        </div>
        <div className="w-full lg:w-6/12 xl:w-3/12 px-4">
          <CardStats
            statSubtitle="Hónapban lejáró határidők"
            statTitle={stats.hatarido.toString()}
            statArrow="down"
            statPercent="1.10"
            statPercentColor="text-orange-500"
            statDescripiron=""
            statIconName="fas fa-calendar-days"
            statIconColor="bg-red-500"
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
