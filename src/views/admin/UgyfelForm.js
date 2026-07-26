import React from "react";
import { useLocation } from "react-router-dom";
import CardUgyfel from "components/Cards/CardUgyfel.js";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

export default function UgyfelForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <div className="flex flex-wrap">
      <div className="w-full px-0 lg:w-12/12 md:px-4">
        <AdminBreadcrumb
          group="Partnerek"
          listLabel="Ügyfelek"
          listPath="/admin/ugyfelek"
          current={data?.nev || "Új ügyfél"}
        />
        <CardUgyfel initialUgyfel={data} />
      </div>
    </div>
  );
}
