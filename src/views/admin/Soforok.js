import React, { useState, useEffect } from "react";
// components

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForSoforok.js";

export default function Soforok() {
  const [soforok, setSoforok] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getSoforok", { id: user.id });
      if (result.success) {
        setSoforok(result.soforok || []);
      } else {
        setSoforok([]);
        console.error("Error fetching stats:", result.message);
      }
    };

    fetchData();
  }, []);
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <CardTable soforok={soforok} />
        </div>
      </div>
    </>
  );
}
