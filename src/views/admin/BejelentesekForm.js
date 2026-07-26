import CardBejelentesek from "components/Cards/bejelentesek/CardBejelentesek";
import React from "react";
import { useLocation } from "react-router-dom";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

// components

export default function BejelentesekForm() {
  const location = useLocation();
  const data = location.state?.data;
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Csapat"
            listLabel="Bejelentések"
            listPath="/admin/bejelentesek"
            current={data?.cim || "Új bejelentés"}
          />
          <CardBejelentesek initBejelentesek={data} />
        </div>
      </div>
    </>
  );
}
