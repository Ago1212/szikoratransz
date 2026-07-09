import React from "react";
import { useLocation } from "react-router-dom";

// components

import CardKamion from "components/Cards/CardKamion";

export default function KamionForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <CardKamion initialKamion ={data}/>
        </div>
      </div>
    </>
  );
}
