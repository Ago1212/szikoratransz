import React, { useState, useEffect } from "react";

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForHelyszinek.js";

export default function Helyszinek() {
  const [helyszinek, setHelyszinek] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getHelyszinek", { id: user.ceg_id });
      if (result.success) {
        setHelyszinek(result.helyszinek || []);
      } else {
        setHelyszinek([]);
        console.error("Error fetching helyszinek:", result.message);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable helyszinek={helyszinek} />
        </div>
      </div>
    </>
  );
}
