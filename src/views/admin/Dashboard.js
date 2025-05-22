import React, { useEffect, useState } from "react";

// components
import CardStats from "components/Cards/CardStats";
import CardCalender from "components/Cards/CardCalender";
import { fetchAction } from "utils/fetchAction";

const StatCard = ({
  title,
  value,
  statIconName,
  iconColor,
  trend,
  percentage,
  trendColor,
}) => (
  <div className="w-full lg:w-6/12 xl:w-3/12 px-4 mb-4 lg:mb-0">
    <CardStats
      statSubtitle={title}
      statTitle={value.toString()}
      statArrow={trend}
      statPercent={percentage}
      statPercentColor={trendColor}
      statDescripiron=""
      statIconName={statIconName}
      statIconColor={iconColor}
    />
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    soforok: 0,
    kamionok: 0,
    potkocsik: 0,
    hatarido: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("user"));
        const result = await fetchAction("getSum", { id: user.id });

        if (result.success) {
          setStats({
            soforok: result.sofor || 0,
            kamionok: result.kamion || 0,
            potkocsik: result.potkocsi || 0,
            hatarido: result.hatarido || 0,
          });
        } else {
          setError(result.message || "Error fetching stats");
        }
      } catch (err) {
        setError("Failed to fetch data");
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      {/* Stats Cards Section */}
      <div className="flex flex-wrap -mx-4">
        <StatCard
          title="Sofőrök"
          value={stats.soforok}
          statIconName="fas fa-users"
          iconColor="bg-indigo-500"
          trend="up"
          percentage="3.48"
          trendColor="text-emerald-500"
        />

        <StatCard
          title="Kamionok"
          value={stats.kamionok}
          statIconName="fas fa-truck"
          iconColor="bg-red-500"
          trend="up"
          percentage="2.59"
          trendColor="text-emerald-500"
        />

        <StatCard
          title="Pótkocsik"
          value={stats.potkocsik}
          statIconName="fas fa-trailer"
          iconColor="bg-pink-500"
          trend="down"
          percentage="1.10"
          trendColor="text-orange-500"
        />

        <StatCard
          title="Lejáró határidők"
          value={stats.hatarido}
          statIconName="fas fa-calendar-days"
          iconColor="bg-blue-500"
          trend="same"
          percentage="0.00"
          trendColor="text-gray-500"
        />
      </div>

      {/* Calendar Section */}
      <div className="w-full mt-8 mb-12">
        <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white border-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Eseménynaptár
            </h3>
          </div>
          <CardCalender />
        </div>
      </div>
    </div>
  );
}
