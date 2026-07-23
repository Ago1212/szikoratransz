import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  PiCarLight,
  PiShieldCheckLight,
  PiCalendarBlankLight,
  PiMoneyLight,
  PiBuildingsLight,
  PiIdentificationCardLight,
  PiFireExtinguisherLight,
  PiTruckTrailerLight,
  PiGaugeLight,
  PiMapPinLight,
  PiRulerLight,
} from "react-icons/pi";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import { useListaElemek } from "utils/useListaElemek.js";

const CardPotkocsiAdatokForm = ({ potkocsi, setFormData, handleSave }) => {
  // UX-audit (2026-07-23): a Kamion/Furgon modul mellett a Pótkocsiból
  // korábban hiányzott a "Méret" mező — ld. potkocsi_meret a listaInterface
  // TIPUSOK regiszterében.
  const { elemek: meretOptions } = useListaElemek("potkocsi_meret");
  const { elemek: allapotOptions } = useListaElemek("jarmu_allapot");
  const { elemek: utemOptions } = useListaElemek("biztositas_utem");
  const [nextKotBizInfo, setNextKotBizInfo] = useState({ date: "", amount: "" });
  const [nextKaszkoInfo, setNextKaszkoInfo] = useState({ date: "", amount: "" });
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

    if (potkocsi.kot_biztositas && potkocsi.kot_biz_utem && potkocsi.kot_biz_dij) {
      calculateNextPayment(
        potkocsi.kot_biztositas,
        potkocsi.kot_biz_utem,
        potkocsi.kot_biz_dij,
        setNextKotBizInfo
      );
    } else {
      setNextKotBizInfo({ date: "", amount: "" });
    }

    if (potkocsi.kaszko_biztositas && potkocsi.kaszko_fizetesi_utem && potkocsi.kaszko_dij) {
      calculateNextPayment(
        potkocsi.kaszko_biztositas,
        potkocsi.kaszko_fizetesi_utem,
        potkocsi.kaszko_dij,
        setNextKaszkoInfo
      );
    } else {
      setNextKaszkoInfo({ date: "", amount: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          amount / (frequency === "Negyed év" ? 4 : frequency === "Fél év" ? 2 : 1)
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

  const parseNumber = (value) => parseFloat(value.replace(/\s/g, "")) || 0;

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData((prevPotkocsi) => ({ ...prevPotkocsi, [id]: value }));
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection id="fo-adatok" title="Fő adatok" icon={PiTruckTrailerLight} columns={4}>
        <FormField
          icon={PiIdentificationCardLight}
          label="Rendszám"
          id="rendszam"
          value={potkocsi.rendszam || ""}
          onChange={handleFormChange}
          required
        />
        <FormField
          icon={PiTruckTrailerLight}
          label="Típus"
          id="tipus"
          value={potkocsi.tipus || ""}
          onChange={handleFormChange}
          placeholder="Pótkocsi típusa"
        />
        <FormField
          as="select"
          icon={PiRulerLight}
          label="Méret"
          id="meret"
          value={potkocsi.meret || ""}
          onChange={handleFormChange}
        >
          <option value="">Válassz...</option>
          {meretOptions.map((o) => (
            <option key={o.kulcs} value={o.kulcs}>
              {o.nev}
            </option>
          ))}
        </FormField>
        <FormField
          as="select"
          icon={PiMapPinLight}
          label="Állapot"
          id="allapot"
          value={potkocsi.allapot || "szabad"}
          onChange={handleFormChange}
        >
          {allapotOptions.map((o) => (
            <option key={o.kulcs} value={o.kulcs}>
              {o.nev}
            </option>
          ))}
        </FormField>
        <FormField
          type="number"
          icon={PiGaugeLight}
          label="Jelenlegi km-óraállás"
          id="aktualis_km"
          value={potkocsi.aktualis_km || ""}
          onChange={handleFormChange}
          placeholder="pl. 214500"
        />
      </FormSection>

      <FormSection id="lejaratok" title="Lejárati dátumok" icon={PiCalendarBlankLight} columns={3}>
        <FormField
          type="date"
          icon={PiCarLight}
          label="Műszaki"
          id="muszaki_lejarat"
          value={potkocsi.muszaki_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiShieldCheckLight}
          label="Adr"
          id="adr_lejarat"
          value={potkocsi.adr_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiIdentificationCardLight}
          label="Taográf illesztés"
          id="taograf_illesztes"
          value={potkocsi.taograf_illesztes}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiTruckTrailerLight}
          label="Emelő hátfal"
          id="emelohatfal_vizsga"
          value={potkocsi.emelohatfal_vizsga}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiFireExtinguisherLight}
          label="Poroltó #1"
          id="porolto_lejarat"
          value={potkocsi.porolto_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiFireExtinguisherLight}
          label="Poroltó #2"
          id="porolto_lejarat_2"
          value={potkocsi.porolto_lejarat_2}
          onChange={handleFormChange}
        />
      </FormSection>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <FormSection id="kotelezo-biztositas" title="Kötelező biztosítás" icon={PiShieldCheckLight} columns={3}>
        <FormField
          as="select"
          icon={PiCalendarBlankLight}
          label="Ütem"
          id="kot_biz_utem"
          value={potkocsi.kot_biz_utem || ""}
          onChange={handleFormChange}
        >
          <option value="">Válassz...</option>
          {utemOptions.map((o) => (
            <option key={o.kulcs} value={o.kulcs}>
              {o.nev}
            </option>
          ))}
        </FormField>
        <FormField
          type="date"
          icon={PiCalendarBlankLight}
          label="Kezdő dátum"
          id="kot_biztositas"
          value={potkocsi.kot_biztositas || ""}
          onChange={handleFormChange}
        />
        <div className="relative">
          <FormField
            icon={PiMoneyLight}
            label="Éves díj"
            inputMode="decimal"
            value={editKotBizDij ? kotBizDijValue : formatNumber(potkocsi.kot_biz_dij)}
            onChange={(e) => handleCurrencyChange(e, "kot_biz_dij")}
            onFocus={() => handleCurrencyFocus("kot_biz_dij")}
            onBlur={() => handleCurrencyBlur("kot_biz_dij")}
          />
          {!editKotBizDij && (
            <span className="pointer-events-none absolute right-3 top-[38px] text-sm text-ink-400 dark:text-ink-500">
              Ft
            </span>
          )}
        </div>
        <FormField
          icon={PiBuildingsLight}
          label="Biztosító neve"
          id="kot_biz_nev"
          value={potkocsi.kot_biz_nev || ""}
          onChange={handleFormChange}
          placeholder="Kötelező bizt. biztosítója"
        />
        <FormField
          as="info"
          icon={PiCalendarBlankLight}
          label="Következő fizetés dátuma"
          value={nextKotBizInfo.date}
        />
        <FormField
          as="info"
          icon={PiMoneyLight}
          label="Következő fizetés összege"
          value={nextKotBizInfo.amount}
        />
      </FormSection>

      <FormSection id="kaszko-biztositas" title="Kaszkó biztosítás" icon={PiShieldCheckLight} columns={3}>
        <FormField
          as="select"
          icon={PiCalendarBlankLight}
          label="Ütem"
          id="kaszko_fizetesi_utem"
          value={potkocsi.kaszko_fizetesi_utem || ""}
          onChange={handleFormChange}
        >
          <option value="">Válassz...</option>
          {utemOptions.map((o) => (
            <option key={o.kulcs} value={o.kulcs}>
              {o.nev}
            </option>
          ))}
        </FormField>
        <FormField
          type="date"
          icon={PiCalendarBlankLight}
          label="Kezdő dátum"
          id="kaszko_biztositas"
          value={potkocsi.kaszko_biztositas || ""}
          onChange={handleFormChange}
        />
        <div className="relative">
          <FormField
            icon={PiMoneyLight}
            label="Éves díj"
            inputMode="decimal"
            value={editKaszkoDij ? kaszkoDijValue : formatNumber(potkocsi.kaszko_dij)}
            onChange={(e) => handleCurrencyChange(e, "kaszko_dij")}
            onFocus={() => handleCurrencyFocus("kaszko_dij")}
            onBlur={() => handleCurrencyBlur("kaszko_dij")}
          />
          {!editKaszkoDij && (
            <span className="pointer-events-none absolute right-3 top-[38px] text-sm text-ink-400 dark:text-ink-500">
              Ft
            </span>
          )}
        </div>
        <FormField
          icon={PiBuildingsLight}
          label="Biztosító neve"
          id="kaszko_nev"
          value={potkocsi.kaszko_nev || ""}
          onChange={handleFormChange}
          placeholder="Kaszkó bizt. biztosítója"
        />
        <FormField
          as="info"
          icon={PiCalendarBlankLight}
          label="Következő fizetés dátuma"
          value={nextKaszkoInfo.date}
        />
        <FormField
          as="info"
          icon={PiMoneyLight}
          label="Következő fizetés összege"
          value={nextKaszkoInfo.amount}
        />
      </FormSection>
      </div>

      <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
        <SaveButton
          onClick={handleSubmit}
          isSaving={isSaving}
          label={potkocsi.id ? "Mentés" : "Pótkocsi rögzítése"}
        />
      </div>
    </form>
  );
};

CardPotkocsiAdatokForm.propTypes = {
  potkocsi: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
};

export default CardPotkocsiAdatokForm;
