import React from "react";
import { useLocation } from "react-router-dom";

// components

import CardKamion from "components/Cards/CardKamion";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

export default function KamionForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Flotta"
            listLabel="Kamionok"
            listPath="/admin/kamionok"
            current={data?.rendszam || "Új kamion"}
          />
          <CardKamion initialKamion ={data}/>
        </div>
      </div>
    </>
  );
}
