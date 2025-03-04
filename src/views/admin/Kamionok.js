import React, { useState, useEffect } from "react";

// components

import CardTable from "components/Table/CardTableForKamionok.js";
import { fetchAction } from "utils/fetchAction";

export default function Kamionok() {
  const [kamionok, setKamionok] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem('user'));
      const result = await fetchAction("getKamionok", { id: user.id });
      if (result.success) {
        setKamionok(result.kamionok || []);
      } else {
        setKamionok([]);
        console.error("Error fetching stats:", result.message);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
        <CardTable kamionok={kamionok} />
        </div>
      </div>
    </>
  );
}
