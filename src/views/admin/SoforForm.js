import CardSoforok from "components/Cards/sofor/CardSofor";
import React from "react";
import { useLocation } from "react-router-dom";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

// components

export default function SoforForm() {
  const location = useLocation();
  const data = location.state?.data;
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Csapat"
            listLabel="Sofőrök"
            listPath="/admin/soforok"
            current={data?.name || "Új sofőr"}
          />
          <CardSoforok initSofor={data} />
        </div>
      </div>
    </>
  );
}
