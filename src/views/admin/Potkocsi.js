import React, { useState, useEffect } from "react";
// components

import CardTable from "components/Table/CardTableForPotkocsi";
import { fetchAction } from "utils/fetchAction";

export default function Potkocsi() {
  const [potkocsik, setPotkocsik] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getPotkocsik", { id: user.id });
      if (result.success) {
        setPotkocsik(result.potkocsik || []);
      } else {
        setPotkocsik([]);
        console.error("Error fetching stats:", result.message);
      }
    };

    fetchData();
  }, []);
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <CardTable potkocsik={potkocsik} />
        </div>
      </div>
    </>
  );
}
