import React, { useState, useEffect } from "react";

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForUgyfelek.js";

export default function Ugyfelek() {
  const [ugyfelek, setUgyfelek] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getUgyfelek", { id: user.ceg_id });
      if (result.success) {
        setUgyfelek(result.ugyfelek || []);
      } else {
        setUgyfelek([]);
        console.error("Error fetching ugyfelek:", result.message);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable ugyfelek={ugyfelek} />
        </div>
      </div>
    </>
  );
}
