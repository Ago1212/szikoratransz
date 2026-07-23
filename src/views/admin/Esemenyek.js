import CardTableForEsemenyek from "components/Table/CardTableForEsemenyek";
import PageHeader from "components/UI/PageHeader.js";
import React from "react";

// components

export default function Esemenyek() {
  const storedUserData = localStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  return (
    <>
      <PageHeader eyebrow="Rendszer" title="Egyedi határidők" />
      {/* UX-audit — a korábbi "Események" cím + "Új esemény" gomb azt sugallta,
          hogy itt minden esemény (lejáró okmányok, karbantartások stb.) kezelhető,
          miközben az oldal ténylegesen csak az egyedi, kézzel felvitt határidőket
          listázza — az automatikusan számolt események a Dashboard naptárában,
          ill. a jármű/sofőr saját adatlapján szerkeszthetők. */}
      <p className="-mt-8 mb-6 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
        Egyéni, egyszeri határidők (pl. egy adott ügyintézés napja) — a jogsi/műszaki/biztosítási
        lejáratok automatikusan, a jármű vagy sofőr adatlapján szerkeszthetők, azok itt nem jelennek meg.
      </p>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTableForEsemenyek id={initialUserData.ceg_id} />
        </div>
      </div>
    </>
  );
}
