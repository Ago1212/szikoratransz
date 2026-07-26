import CardPotkocsi from "components/Cards/CardPotkocsi";
import React from "react";
import { useLocation } from "react-router-dom";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

// components

export default function PotkocsiForm() {
  const location = useLocation();
  const data = location.state?.data;
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Flotta"
            listLabel="Pótkocsik"
            listPath="/admin/potkocsi"
            current={data?.rendszam || "Új pótkocsi"}
          />
          <CardPotkocsi initialPotkocsi={data} />
        </div>
      </div>
    </>
  );
}
