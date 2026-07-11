import React from "react";
import { useLocation } from "react-router-dom";
import CardHelyszin from "components/Cards/CardHelyszin.js";

export default function HelyszinForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <div className="flex flex-wrap">
      <div className="w-full px-0 lg:w-12/12 md:px-4">
        <CardHelyszin initialHelyszin={data} />
      </div>
    </div>
  );
}
