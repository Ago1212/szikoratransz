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
  PiTruckLight,
  PiTruckTrailerLight,
  PiRulerLight,
  PiGaugeLight,
  PiMapPinLight,
  PiScalesLight,
} from "react-icons/pi";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import LejaratTag from "components/UI/LejaratTag.js";
import { useListaElemek } from "utils/useListaElemek.js";
import { fetchAction } from "utils/fetchAction";

const CardJarmuAdatokForm = ({ kamion, setFormData, handleSave }) => {
  const { elemek: meretOptions } = useListaElemek("kamion_meret");
  const { elemek: allapotOptions } = useListaElemek("jarmu_allapot");
  const { elemek: utemOptions } = useListaElemek("biztositas_utem");
  const [nextKotBizInfo, setNextKotBizInfo] = useState({ date: "", amount: "" });
  const [nextKaszkoInfo, setNextKaszkoInfo] = useState({ date: "", amount: "" });
  const [editKotBizDij, setEditKotBizDij] = useState(false);
  const [editKaszkoDij, setEditKaszkoDij] = useState(false);
  const [kotBizDijValue, setKotBizDijValue] = useState("");
  const [kaszkoDijValue, setKaszkoDijValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // A pótkocsi-választóhoz szükséges lista — ugyanúgy töltjük be, mint a
  // Sofőr adatlapon (CardSoforAdatokForm.js). A mező opcionális (nem minden
  // kamionhoz van hozzárendelve pótkocsi, ld. backend/sql/25.sql).
  const [potkocsik, setPotkocsik] = useState([]);
  useEffect(() => {
    const admin = JSON.parse(localStorage.getItem("user") || "null");
    if (!admin) return;
    fetchAction("getPotkocsiRendszamok", { id: admin.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
  }, []);

  useEffect(() => {
    if (kamion.kot_biz_dij) {
      setKotBizDijValue(formatNumber(kamion.kot_biz_dij));
    }
    if (kamion.kaszko_dij) {
      setKaszkoDijValue(formatNumber(kamion.kaszko_dij));
    }

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

    if (kamion.kaszko_biztositas && kamion.kaszko_fizetesi_utem && kamion.kaszko_dij) {
      calculateNextPayment(
        kamion.kaszko_biztositas,
        kamion.kaszko_fizetesi_utem,
        kamion.kaszko_dij,
        setNextKaszkoInfo
      );
    } else {
      setNextKaszkoInfo({ date: "", amount: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setFormData((prevKamion) => ({ ...prevKamion, [id]: value }));
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
      <FormSection id="fo-adatok" title="Fő adatok" icon={PiCarLight} columns={4}>
        <FormField
          icon={PiIdentificationCardLight}
          label="Rendszám"
          id="rendszam"
          value={kamion.rendszam || ""}
          onChange={handleFormChange}
          required
        />
        <FormField
          icon={PiTruckLight}
          label="Típus"
          id="tipus"
          value={kamion.tipus || ""}
          onChange={handleFormChange}
          placeholder="Jármű típusa"
        />
        <FormField
          as="select"
          icon={PiRulerLight}
          label="Méret"
          id="meret"
          value={kamion.meret || ""}
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
          type="number"
          step="0.1"
          icon={PiScalesLight}
          label="Teherbírás (t)"
          id="teherbiras"
          value={kamion.teherbiras || ""}
          onChange={handleFormChange}
        />
        <FormField
          as="select"
          icon={PiTruckTrailerLight}
          label="Pótkocsi"
          id="potkocsi"
          value={kamion.potkocsi || ""}
          onChange={handleFormChange}
        >
          <option value="">Nincs hozzárendelve</option>
          {potkocsik.map((p) => (
            <option key={p.id} value={p.id}>
              {p.tipus ? `${p.rendszam} (${p.tipus})` : p.rendszam}
            </option>
          ))}
        </FormField>
        <FormField
          as="select"
          icon={PiMapPinLight}
          label="Állapot"
          id="allapot"
          value={kamion.allapot || "szabad"}
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
          value={kamion.aktualis_km || ""}
          onChange={handleFormChange}
          placeholder="pl. 214500"
        />
      </FormSection>

      <FormSection id="lejaratok" title="Lejárati dátumok" icon={PiCalendarBlankLight} columns={3}>
        <FormField
          type="date"
          icon={PiCarLight}
          label={<>Műszaki <LejaratTag date={kamion.muszaki_lejarat} /></>}
          id="muszaki_lejarat"
          value={kamion.muszaki_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiShieldCheckLight}
          label={<>Adr <LejaratTag date={kamion.adr_lejarat} /></>}
          id="adr_lejarat"
          value={kamion.adr_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiIdentificationCardLight}
          label={<>Taográf illesztés <LejaratTag date={kamion.taograf_illesztes} /></>}
          id="taograf_illesztes"
          value={kamion.taograf_illesztes}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiTruckLight}
          label={<>Emelő hátfal <LejaratTag date={kamion.emelohatfal_vizsga} /></>}
          id="emelohatfal_vizsga"
          value={kamion.emelohatfal_vizsga}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiFireExtinguisherLight}
          label={<>Poroltó #1 <LejaratTag date={kamion.porolto_lejarat} /></>}
          id="porolto_lejarat"
          value={kamion.porolto_lejarat}
          onChange={handleFormChange}
        />
        <FormField
          type="date"
          icon={PiFireExtinguisherLight}
          label={<>Poroltó #2 <LejaratTag date={kamion.porolto_lejarat_2} /></>}
          id="porolto_lejarat_2"
          value={kamion.porolto_lejarat_2}
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
          value={kamion.kot_biz_utem || ""}
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
          value={kamion.kot_biztositas || ""}
          onChange={handleFormChange}
        />
        <div className="relative">
          <FormField
            icon={PiMoneyLight}
            label="Éves díj"
            inputMode="decimal"
            value={editKotBizDij ? kotBizDijValue : formatNumber(kamion.kot_biz_dij)}
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
          value={kamion.kot_biz_nev || ""}
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
          value={kamion.kaszko_fizetesi_utem || ""}
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
          value={kamion.kaszko_biztositas || ""}
          onChange={handleFormChange}
        />
        <div className="relative">
          <FormField
            icon={PiMoneyLight}
            label="Éves díj"
            inputMode="decimal"
            value={editKaszkoDij ? kaszkoDijValue : formatNumber(kamion.kaszko_dij)}
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
          value={kamion.kaszko_nev || ""}
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
          label={kamion.id ? "Mentés" : "Kamion rögzítése"}
        />
      </div>
    </form>
  );
};

CardJarmuAdatokForm.propTypes = {
  kamion: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
};

export default CardJarmuAdatokForm;
