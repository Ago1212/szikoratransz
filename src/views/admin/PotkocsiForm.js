import CardPotkocsi from "components/Cards/CardPotkocsi";
import React from "react";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

// components

export default function PotkocsiForm() {
  const { data, loading } = useDeepLinkRecord("getPotkocsi", "potkocsi");
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
          {loading ? <Spinner /> : <CardPotkocsi initialPotkocsi={data} />}
        </div>
      </div>
    </>
  );
}
