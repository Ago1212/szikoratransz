import React, { useState, useEffect } from "react";

export default function CardJarmuAdatokForm({
  kamion,
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
    if (kamion.kot_biz_dij) {
      setKotBizDijValue(formatNumber(kamion.kot_biz_dij));
    }
    if (kamion.kaszko_dij) {
      setKaszkoDijValue(formatNumber(kamion.kaszko_dij));
    }

    // Calculate next payment for mandatory insurance
    if (kamion.kot_biztositas && kamion.kot_biz_utem && kamion.kot_biz_dij) {
      calculateNextPayment(
        kamion.kot_biztositas,
        kamion.kot_biz_utem,
        kamion.kot_biz_dij,
        setNextKotBizInfo
      );
    } else {
      setNextKotBizInfo({ date: "", amount: "" });
    }

    // Calculate next payment for casco insurance
    if (
      kamion.kaszko_biztositas &&
      kamion.kaszko_fizetesi_utem &&
      kamion.kaszko_dij
    ) {
      calculateNextPayment(
        kamion.kaszko_biztositas,
        kamion.kaszko_fizetesi_utem,
        kamion.kaszko_dij,
        setNextKaszkoInfo
      );
    } else {
      setNextKaszkoInfo({ date: "", amount: "" });
    }
  }, [
    kamion.kot_biztositas,
    kamion.kot_biz_utem,
    kamion.kot_biz_dij,
    kamion.kaszko_biztositas,
    kamion.kaszko_fizetesi_utem,
    kamion.kaszko_dij,
  ]);

  const calculateNextPayment = (startDate, frequency, totalAmount, setter) => {
    if (!startDate || !frequency || frequency === "Nincs" || !totalAmount) {
      setter({ date: "", amount: "" });
      return;
    }

    const start = new Date(startDate);
    const now = new Date();
    let amount = parseFloat(totalAmount);

    // Helper function to calculate period end date
    const getPeriodEndDate = (date, freq) => {
      const endDate = new Date(date);
      switch (freq) {
        case "Negyed év":
          endDate.setMonth(endDate.getMonth() + 3);
          endDate.setDate(endDate.getDate() - 1);
          break;
        case "Fél év":
          endDate.setMonth(endDate.getMonth() + 6);
          endDate.setDate(endDate.getDate() - 1);
          break;
        case "Éves":
          endDate.setFullYear(endDate.getFullYear() + 1);
          endDate.setDate(endDate.getDate() - 1);
          break;
        default:
          return null;
      }
      return endDate;
    };

    // If start date is in the future, return the first period end with full amount
    if (start > now) {
      const periodEnd = getPeriodEndDate(start, frequency);
      setter({
        date: periodEnd.toISOString().split("T")[0],
        amount: new Intl.NumberFormat("hu-HU", {
          style: "currency",
          currency: "HUF",
          maximumFractionDigits: 0,
        }).format(
          amount /
            (frequency === "Negyed év" ? 4 : frequency === "Fél év" ? 2 : 1)
        ),
      });
      return;
    }

    // Calculate the next upcoming period end
    let periodStart = new Date(start);
    let periodEnd = getPeriodEndDate(periodStart, frequency);

    while (periodEnd <= now) {
      // Move to next period
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
      periodEnd = getPeriodEndDate(periodStart, frequency);
    }

    // Calculate the amount based on frequency
    let paymentAmount;
    switch (frequency) {
      case "Negyed év":
        paymentAmount = amount / 4;
        break;
      case "Fél év":
        paymentAmount = amount / 2;
        break;
      case "Éves":
        paymentAmount = amount;
        break;
      default:
        paymentAmount = 0;
    }

    setter({
      date: periodEnd.toISOString().split("T")[0],
      amount: new Intl.NumberFormat("hu-HU", {
        style: "currency",
        currency: "HUF",
        maximumFractionDigits: 0,
      }).format(paymentAmount),
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
    setFormData((prevKamion) => ({
      ...prevKamion,
      [id]: value,
    }));
  };

  const handleCurrencyFocus = (field) => {
    if (field === "kot_biz_dij") {
      setEditKotBizDij(true);
      setKotBizDijValue(kamion.kot_biz_dij || "");
    } else if (field === "kaszko_dij") {
      setEditKaszkoDij(true);
      setKaszkoDijValue(kamion.kaszko_dij || "");
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
              value={kamion.rendszam}
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
              value={kamion.tipus || ""}
              id="tipus"
              onChange={handleFormChange}
              placeholder="Jármű típusa"
            />
          </div>
        </div>
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="meret"
            >
              Méret
            </label>
            <select
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.meret || ""}
              id="meret"
              onChange={handleFormChange}
            >
              <option value="">Válassz...</option>
              <option value="3.5T">3.5T</option>
              <option value="7.5T">7.5T</option>
              <option value="12T">12T</option>
              <option value="18T">18T</option>
              <option value="24T">24T</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="potkocsi"
            >
              Pótkocsi
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.potkocsi}
              id="potkocsi"
              onChange={handleFormChange}
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
              value={kamion.muszaki_lejarat}
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
              value={kamion.adr_lejarat}
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
              value={kamion.taograf_illesztes}
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
              value={kamion.emelohatfal_vizsga}
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
              value={kamion.porolto_lejarat}
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
              value={kamion.porolto_lejarat_2}
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
        {/* Ütem kiválasztó */}
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
              value={kamion.kot_biz_utem || ""}
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
        {/* Dátum mező */}
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
              value={kamion.kot_biztositas || ""}
              id="kot_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>

        {/* Díj mező */}
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
                  : formatNumber(kamion.kot_biz_dij)
              }
              onChange={(e) => handleCurrencyChange(e, "kot_biz_dij")}
              onFocus={() => handleCurrencyFocus("kot_biz_dij")}
              onBlur={() => handleCurrencyBlur("kot_biz_dij")}
            />
            {!editKotBizDij && (
              <span className="absolute right-3 top-10 text-blueGray-600">
                Ft
              </span>
            )}
          </div>
        </div>

        {/* Biztosító neve */}
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
              value={kamion.kot_biz_nev || ""}
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
        {/* Ütem kiválasztó */}
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
              value={kamion.kaszko_fizetesi_utem || ""}
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
        {/* Dátum mező */}
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
              value={kamion.kaszko_biztositas || ""}
              id="kaszko_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>

        {/* Díj mező */}
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
                editKaszkoDij ? kaszkoDijValue : formatNumber(kamion.kaszko_dij)
              }
              onChange={(e) => handleCurrencyChange(e, "kaszko_dij")}
              onFocus={() => handleCurrencyFocus("kaszko_dij")}
              onBlur={() => handleCurrencyBlur("kaszko_dij")}
            />
            {!editKaszkoDij && (
              <span className="absolute right-3 top-10 text-blueGray-600">
                Ft
              </span>
            )}
          </div>
        </div>

        {/* Biztosító neve */}
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
              value={kamion.kaszko_nev || ""}
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
