import React from "react";
import CardHelyszin from "components/Cards/CardHelyszin.js";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

export default function HelyszinForm() {
  const { data, loading } = useDeepLinkRecord("getHelyszin", "helyszin");

  return (
    <div className="flex flex-wrap">
      <div className="w-full px-0 lg:w-12/12 md:px-4">
        <AdminBreadcrumb
          group="Partnerek"
          listLabel="Helyszínek"
          listPath="/admin/helyszinek"
          current={data?.nev || "Új helyszín"}
        />
        {loading ? <Spinner /> : <CardHelyszin initialHelyszin={data} />}
      </div>
    </div>
  );
}
