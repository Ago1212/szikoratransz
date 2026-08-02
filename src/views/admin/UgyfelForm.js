import React from "react";
import CardUgyfel from "components/Cards/CardUgyfel.js";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

export default function UgyfelForm() {
  const { data, loading } = useDeepLinkRecord("getUgyfel", "ugyfel");

  return (
    <div className="flex flex-wrap">
      <div className="w-full px-0 lg:w-12/12 md:px-4">
        <AdminBreadcrumb
          group="Partnerek"
          listLabel="Ügyfelek"
          listPath="/admin/ugyfelek"
          current={data?.nev || "Új ügyfél"}
        />
        {loading ? <Spinner /> : <CardUgyfel initialUgyfel={data} />}
      </div>
    </div>
  );
}
