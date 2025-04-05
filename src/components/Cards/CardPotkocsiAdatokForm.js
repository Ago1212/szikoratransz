import React, { useState, useEffect } from "react";

export default function CardPotkocsiAdatokForm({
  potkocsi,
  setFormData,
  handleSave,
}) {
  const [nextKotBizInfo, setNextKotBizInfo] = useState({
    date: "",
    amount: "",
  });
  const [nextKaszkoInfo, setNextKaszkoInfo] = useState({
    date: "",
    amount: "",
  });
  const [editKotBizDij, setEditKotBizDij] = useState(false);
  const [editKaszkoDij, setEditKaszkoDij] = useState(false);
  const [kotBizDijValue, setKotBizDijValue] = useState("");
  const [kaszkoDijValue, setKaszkoDijValue] = useState("");

  useEffect(() => {
    // Format insurance amounts on load
    if (potkocsi.kot_biz_dij) {
      setKotBizDijValue(formatNumber(potkocsi.kot_biz_dij));
    }
    if (potkocsi.kaszko_dij) {
      setKaszkoDijValue(formatNumber(potkocsi.kaszko_dij));
    }

    // Calculate next payment for mandatory insurance
    if (
      potkocsi.kot_biztositas &&
      potkocsi.kot_biz_utem &&
      potkocsi.kot_biz_dij
    ) {
      calculateNextPayment(
        potkocsi.kot_biztositas,
        potkocsi.kot_biz_utem,
        potkocsi.kot_biz_dij,
        setNextKotBizInfo
      );
    } else {
      setNextKotBizInfo({ date: "", amount: "" });
    }

    // Calculate next payment for casco insurance
    if (
      potkocsi.kaszko_biztositas &&
      potkocsi.kaszko_fizetesi_utem &&
      potkocsi.kaszko_dij
    ) {
      calculateNextPayment(
        potkocsi.kaszko_biztositas,
        potkocsi.kaszko_fizetesi_utem,
        potkocsi.kaszko_dij,
        setNextKaszkoInfo
      );
    } else {
      setNextKaszkoInfo({ date: "", amount: "" });
    }
  }, [
    potkocsi.kot_biztositas,
    potkocsi.kot_biz_utem,
    potkocsi.kot_biz_dij,
    potkocsi.kaszko_biztositas,
    potkocsi.kaszko_fizetesi_utem,
    potkocsi.kaszko_dij,
  ]);

  const calculateNextPayment = (startDate, frequency, totalAmount, setter) => {
    if (!startDate || !frequency || frequency === "Nincs" || !totalAmount) {
      setter({ date: "", amount: "" });
      return;
    }

    const start = new Date(startDate);
    let nextDate = new Date(start);
    let amount = parseFloat(totalAmount);

    switch (frequency) {
      case "Negyed év":
        nextDate.setMonth(start.getMonth() + 3);
        amount = amount / 4;
        break;
      case "Fél év":
        nextDate.setMonth(start.getMonth() + 6);
        amount = amount / 2;
        break;
      case "Éves":
        nextDate.setFullYear(start.getFullYear() + 1);
        break;
      default:
        setter({ date: "", amount: "" });
        return;
    }

    setter({
      date: nextDate.toISOString().split("T")[0],
      amount: new Intl.NumberFormat("hu-HU", {
        style: "currency",
        currency: "HUF",
        maximumFractionDigits: 0,
      }).format(amount),
    });
  };
  const formatNumber = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat("hu-HU").format(value);
  };

  const parseNumber = (value) => {
    return parseFloat(value.replace(/\s/g, "")) || 0;
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleCurrencyFocus = (field) => {
    if (field === "kot_biz_dij") {
      setEditKotBizDij(true);
      setKotBizDijValue(potkocsi.kot_biz_dij || "");
    } else if (field === "kaszko_dij") {
      setEditKaszkoDij(true);
      setKaszkoDijValue(potkocsi.kaszko_dij || "");
    }
  };

  const handleCurrencyBlur = (field) => {
    if (field === "kot_biz_dij") {
      setEditKotBizDij(false);
      const parsedValue = parseNumber(kotBizDijValue);
      setFormData((prev) => ({ ...prev, kot_biz_dij: parsedValue }));
      setKotBizDijValue(formatNumber(parsedValue));
    } else if (field === "kaszko_dij") {
      setEditKaszkoDij(false);
      const parsedValue = parseNumber(kaszkoDijValue);
      setFormData((prev) => ({ ...prev, kaszko_dij: parsedValue }));
      setKaszkoDijValue(formatNumber(parsedValue));
    }
  };
  const handleCurrencyChange = (e, field) => {
    const value = e.target.value;
    if (field === "kot_biz_dij") {
      setKotBizDijValue(value);
    } else if (field === "kaszko_dij") {
      setKaszkoDijValue(value);
    }
  };
  return (
    <form onSubmit={handleSave}>
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Fő adatok
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="rendszam"
            >
              Rendszám
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.rendszam}
              id="rendszam"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="tipus"
            >
              Típus
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.tipus || ""}
              id="tipus"
              onChange={handleFormChange}
              placeholder="Pótkocsi típusa"
            />
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />

      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Lejárati dátumok
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="muszaki_lejarat"
            >
              Műszaki
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.muszaki_lejarat}
              id="muszaki_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="adr_lejarat"
            >
              Adr
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.adr_lejarat}
              id="adr_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="taograf_illesztes"
            >
              Taográf illesztés
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.taograf_illesztes}
              id="taograf_illesztes"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="emelohatfal_vizsga"
            >
              Emelő hátfal
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.emelohatfal_vizsga}
              id="emelohatfal_vizsga"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="porolto_lejarat"
            >
              Poroltó #1
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.porolto_lejarat}
              id="porolto_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="porolto_lejarat_2"
            >
              Poroltó #2
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.porolto_lejarat_2}
              id="porolto_lejarat_2"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Kötelező biztosítás
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biz_utem"
            >
              Ütem
            </label>
            <select
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kot_biz_utem || ""}
              id="kot_biz_utem"
              onChange={handleFormChange}
            >
              <option value="">Válassz...</option>
              <option value="Nincs">Nincs</option>
              <option value="Negyed év">Negyed év</option>
              <option value="Fél év">Fél év</option>
              <option value="Éves">Éves</option>
            </select>
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biztositas"
            >
              Kezdő dátum
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kot_biztositas || ""}
              id="kot_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biz_dij"
            >
              Éves díj
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={
                editKotBizDij
                  ? kotBizDijValue
                  : formatNumber(potkocsi.kot_biz_dij)
              }
              onChange={(e) => handleCurrencyChange(e, "kot_biz_dij")}
              onFocus={() => handleCurrencyFocus("kot_biz_dij")}
              onBlur={() => handleCurrencyBlur("kot_biz_dij")}
              id="kot_biz_dij"
            />
            {!editKotBizDij && (
              <span className="absolute right-3 top-10 text-blueGray-600">
                Ft
              </span>
            )}
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biz_nev"
            >
              Biztosító neve
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kot_biz_nev || ""}
              id="kot_biz_nev"
              onChange={handleFormChange}
              placeholder="Kötelező bizt. biztosítója"
            />
          </div>
        </div>
      </div>

      {/* Next payment info for mandatory insurance */}
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
              Következő fizetés dátuma
            </label>
            <div className="border-0 px-3 py-3 text-blueGray-600 bg-blueGray-100 rounded text-sm shadow w-full">
              {nextKotBizInfo.date || "-"}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
              Következő fizetés összege
            </label>
            <div className="border-0 px-3 py-3 text-blueGray-600 bg-blueGray-100 rounded text-sm shadow w-full">
              {nextKotBizInfo.amount || "-"}
            </div>
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Kaszkó fizetési ütem
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_fizetesi_utem"
            >
              Ütem
            </label>
            <select
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kaszko_fizetesi_utem || ""}
              id="kaszko_fizetesi_utem"
              onChange={handleFormChange}
            >
              <option value="">Válassz...</option>
              <option value="Nincs">Nincs</option>
              <option value="Negyed év">Negyed év</option>
              <option value="Fél év">Fél év</option>
              <option value="Éves">Éves</option>
            </select>
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_biztositas"
            >
              Kezdő dátum
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kaszko_biztositas || ""}
              id="kaszko_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_dij"
            >
              Éves díj
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={
                editKaszkoDij
                  ? kaszkoDijValue
                  : formatNumber(potkocsi.kaszko_dij)
              }
              onChange={(e) => handleCurrencyChange(e, "kaszko_dij")}
              onFocus={() => handleCurrencyFocus("kaszko_dij")}
              onBlur={() => handleCurrencyBlur("kaszko_dij")}
              id="kaszko_dij"
            />
            {!editKaszkoDij && (
              <span className="absolute right-3 top-10 text-blueGray-600">
                Ft
              </span>
            )}
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_nev"
            >
              Biztosító neve
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={potkocsi.kaszko_nev || ""}
              id="kaszko_nev"
              onChange={handleFormChange}
              placeholder="Kaszkó bizt. biztosítója"
            />
          </div>
        </div>
      </div>

      {/* Next payment info for casco insurance */}
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
              Következő fizetés dátuma
            </label>
            <div className="border-0 px-3 py-3 text-blueGray-600 bg-blueGray-100 rounded text-sm shadow w-full">
              {nextKaszkoInfo.date || "-"}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label className="block uppercase text-blueGray-600 text-xs font-bold mb-2">
              Következő fizetés összege
            </label>
            <div className="border-0 px-3 py-3 text-blueGray-600 bg-blueGray-100 rounded text-sm shadow w-full">
              {nextKaszkoInfo.amount || "-"}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
