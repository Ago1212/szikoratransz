import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  FaCar,
  FaShieldAlt,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaBuilding,
  FaIdCard,
  FaFireExtinguisher,
  FaTrailer,
} from "react-icons/fa";

const CardPotkocsiAdatokForm = ({ potkocsi, setFormData, handleSave }) => {
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (potkocsi.kot_biz_dij) {
      setKotBizDijValue(formatNumber(potkocsi.kot_biz_dij));
    }
    if (potkocsi.kaszko_dij) {
      setKaszkoDijValue(formatNumber(potkocsi.kaszko_dij));
    }

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
    const now = new Date();
    let amount = parseFloat(totalAmount);

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

    let periodStart = new Date(start);
    let periodEnd = getPeriodEndDate(periodStart, frequency);

    while (periodEnd <= now) {
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
      periodEnd = getPeriodEndDate(periodStart, frequency);
    }

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
    setFormData((prevPotkocsi) => ({
      ...prevPotkocsi,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await handleSave();
    } finally {
      setIsSaving(false);
    }
  };

  const InputField = ({
    icon: Icon,
    label,
    name,
    type = "text",
    value,
    required = false,
    ...props
  }) => (
    <div className="relative w-full mb-4">
      <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
        <Icon className="mr-2 text-blue-500" />
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        name={name}
        id={name}
        value={value || ""}
        onChange={type === "text" ? handleFormChange : props.onChange}
        className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
        required={required}
        {...props}
      />
    </div>
  );

  const SelectField = ({
    icon: Icon,
    label,
    name,
    value,
    children,
    ...props
  }) => (
    <div className="relative w-full mb-4">
      <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
        <Icon className="mr-2 text-blue-500" />
        {label}
      </label>
      <select
        className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
        value={value || ""}
        id={name}
        onChange={handleFormChange}
        {...props}
      >
        {children}
      </select>
    </div>
  );

  const DateField = ({ icon: Icon, label, name, value, ...props }) => (
    <div className="relative w-full mb-4">
      <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
        <Icon className="mr-2 text-blue-500" />
        {label}
      </label>
      <input
        type="date"
        className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
        value={value || ""}
        id={name}
        onChange={handleFormChange}
        {...props}
      />
    </div>
  );

  const InfoField = ({ icon: Icon, label, value }) => (
    <div className="relative w-full mb-4">
      <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
        <Icon className="mr-2 text-blue-500" />
        {label}
      </label>
      <div className="border-0 px-3 py-3 text-gray-700 bg-gray-100 rounded-lg text-sm shadow w-full">
        {value || "-"}
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 rounded-lg bg-white border-0">
      <form onSubmit={handleSubmit} className="flex-auto px-4 lg:px-10 py-10">
        {/* Main Data Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            <FaTrailer className="mr-2" />
            Fő adatok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaIdCard}
                label="Rendszám"
                name="rendszam"
                value={potkocsi.rendszam}
                required
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaTrailer}
                label="Típus"
                name="tipus"
                value={potkocsi.tipus || ""}
                placeholder="Pótkocsi típusa"
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Expiry Dates Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            <FaCalendarAlt className="mr-2" />
            Lejárati dátumok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaCar}
                label="Műszaki"
                name="muszaki_lejarat"
                value={potkocsi.muszaki_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaShieldAlt}
                label="Adr"
                name="adr_lejarat"
                value={potkocsi.adr_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaIdCard}
                label="Taográf illesztés"
                name="taograf_illesztes"
                value={potkocsi.taograf_illesztes}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaTrailer}
                label="Emelő hátfal"
                name="emelohatfal_vizsga"
                value={potkocsi.emelohatfal_vizsga}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaFireExtinguisher}
                label="Poroltó #1"
                name="porolto_lejarat"
                value={potkocsi.porolto_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaFireExtinguisher}
                label="Poroltó #2"
                name="porolto_lejarat_2"
                value={potkocsi.porolto_lejarat_2}
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Mandatory Insurance Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            <FaShieldAlt className="mr-2" />
            Kötelező biztosítás
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <SelectField
                icon={FaCalendarAlt}
                label="Ütem"
                name="kot_biz_utem"
                value={potkocsi.kot_biz_utem || ""}
              >
                <option value="">Válassz...</option>
                <option value="Nincs">Nincs</option>
                <option value="Negyed év">Negyed év</option>
                <option value="Fél év">Fél év</option>
                <option value="Éves">Éves</option>
              </SelectField>
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaCalendarAlt}
                label="Kezdő dátum"
                name="kot_biztositas"
                value={potkocsi.kot_biztositas || ""}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaMoneyBillWave className="mr-2 text-blue-500" />
                  Éves díj
                </label>
                <input
                  type="text"
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
                  value={
                    editKotBizDij
                      ? kotBizDijValue
                      : formatNumber(potkocsi.kot_biz_dij)
                  }
                  onChange={(e) => handleCurrencyChange(e, "kot_biz_dij")}
                  onFocus={() => handleCurrencyFocus("kot_biz_dij")}
                  onBlur={() => handleCurrencyBlur("kot_biz_dij")}
                />
                {!editKotBizDij && (
                  <span className="absolute right-3 top-10 text-gray-600">
                    Ft
                  </span>
                )}
              </div>
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaBuilding}
                label="Biztosító neve"
                name="kot_biz_nev"
                value={potkocsi.kot_biz_nev || ""}
                placeholder="Kötelező bizt. biztosítója"
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InfoField
                icon={FaCalendarAlt}
                label="Következő fizetés dátuma"
                value={nextKotBizInfo.date}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InfoField
                icon={FaMoneyBillWave}
                label="Következő fizetés összege"
                value={nextKotBizInfo.amount}
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Casco Insurance Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            <FaShieldAlt className="mr-2" />
            Kaszkó biztosítás
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <SelectField
                icon={FaCalendarAlt}
                label="Ütem"
                name="kaszko_fizetesi_utem"
                value={potkocsi.kaszko_fizetesi_utem || ""}
              >
                <option value="">Válassz...</option>
                <option value="Nincs">Nincs</option>
                <option value="Negyed év">Negyed év</option>
                <option value="Fél év">Fél év</option>
                <option value="Éves">Éves</option>
              </SelectField>
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <DateField
                icon={FaCalendarAlt}
                label="Kezdő dátum"
                name="kaszko_biztositas"
                value={potkocsi.kaszko_biztositas || ""}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaMoneyBillWave className="mr-2 text-blue-500" />
                  Éves díj
                </label>
                <input
                  type="text"
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
                  value={
                    editKaszkoDij
                      ? kaszkoDijValue
                      : formatNumber(potkocsi.kaszko_dij)
                  }
                  onChange={(e) => handleCurrencyChange(e, "kaszko_dij")}
                  onFocus={() => handleCurrencyFocus("kaszko_dij")}
                  onBlur={() => handleCurrencyBlur("kaszko_dij")}
                />
                {!editKaszkoDij && (
                  <span className="absolute right-3 top-10 text-gray-600">
                    Ft
                  </span>
                )}
              </div>
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaBuilding}
                label="Biztosító neve"
                name="kaszko_nev"
                value={potkocsi.kaszko_nev || ""}
                placeholder="Kaszkó bizt. biztosítója"
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InfoField
                icon={FaCalendarAlt}
                label="Következő fizetés dátuma"
                value={nextKaszkoInfo.date}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InfoField
                icon={FaMoneyBillWave}
                label="Következő fizetés összege"
                value={nextKaszkoInfo.amount}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

CardPotkocsiAdatokForm.propTypes = {
  potkocsi: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
};

export default CardPotkocsiAdatokForm;
