import React from "react";
import { useLocation } from "react-router-dom";

// components

import CardFurgon from "components/Cards/CardFurgon";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";

export default function FurgonForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Flotta"
            listLabel="Furgonok"
            listPath="/admin/furgonok"
            current={data?.rendszam || "Új furgon"}
          />
          <CardFurgon initialFurgon={data} />
        </div>
      </div>
    </>
  );
}
