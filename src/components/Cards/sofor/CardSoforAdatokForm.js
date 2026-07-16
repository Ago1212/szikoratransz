import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  PiUserLight,
  PiEnvelopeSimpleLight,
  PiPhoneLight,
  PiCakeLight,
  PiIdentificationCardLight,
  PiCityLight,
  PiHouseLineLight,
  PiFileTextLight,
  PiCarLight,
  PiShieldCheckLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiWalletLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";

const CardSoforAdatokForm = ({ sofor, setFormData, handleSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  // A havi bérezés kizárólag admin szerepkörnek látszik/szerkeszthető —
  // se a sofőr saját magánál (az egy külön oldal/session típus, ott ez a
  // form eleve nem fut le), se más csapattag (pl. fuvarszervező) itt nem
  // láthatja. A backend is önállóan kikényszeríti ezt (ld.
  // soforokInterface.php saveSoforData/getSoforok `$isAdmin` paramétere) —
  // ez a frontend-oldali elrejtés csak UX, nem az egyetlen védelmi vonal.
  const isOwnerAdmin =
    (JSON.parse(sessionStorage.getItem("user") || "null")?.szerepkor) === "admin";

  useEffect(() => {
    const admin = JSON.parse(sessionStorage.getItem("user") || "null");
    if (!admin) return;
    fetchAction("getKamionRendszamok", { id: admin.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    fetchAction("getPotkocsiRendszamok", { id: admin.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
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
      <FormSection id="felhasznalo-adatok" title="Felhasználó adatok" columns={4}>
        <FormField
          icon={PiUserLight}
          label="Név"
          name="name"
          value={sofor.name || ""}
          onChange={handleInputChange}
          required
          className="md:col-span-2"
        />
        <FormField
          icon={PiEnvelopeSimpleLight}
          label="Email cím"
          type="email"
          name="email"
          value={sofor.email || ""}
          onChange={handleInputChange}
          className="md:col-span-2"
        />
        <FormField
          icon={PiPhoneLight}
          label="Telefonszám"
          type="tel"
          name="phone"
          value={sofor.phone || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiCakeLight}
          label="Születési dátum"
          type="date"
          name="szul_datum"
          value={sofor.szul_datum || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiIdentificationCardLight}
          label="Személyigazolvány szám"
          name="szemelyi"
          value={sofor.szemelyi || ""}
          onChange={handleInputChange}
        />
      </FormSection>

      <FormSection id="kapcsolat" title="Kapcsolat" columns={3}>
        <FormField
          icon={PiCityLight}
          label="Város"
          name="varos"
          value={sofor.varos || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiFileTextLight}
          label="IRSZ"
          inputMode="numeric"
          name="irsz"
          value={sofor.irsz || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiHouseLineLight}
          label="Cím"
          name="cim"
          value={sofor.cim || ""}
          onChange={handleInputChange}
        />
      </FormSection>

      <FormSection id="dokumentumok" title="Dokumentumok lejárati dátumai" columns={4}>
        <FormField
          icon={PiIdentificationCardLight}
          label="Személyi lejárat"
          type="date"
          name="szemelyi_lejarat"
          value={sofor.szemelyi_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiCarLight}
          label="Jogosítvány lejárat"
          type="date"
          name="jogsi_lejarat"
          value={sofor.jogsi_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiShieldCheckLight}
          label="GKI lejárat"
          type="date"
          name="gki_lejarat"
          value={sofor.gki_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={PiTruckLight}
          label="ADR lejárat"
          type="date"
          name="adr_lejarat"
          value={sofor.adr_lejarat || ""}
          onChange={handleInputChange}
        />
      </FormSection>

      {sofor.id && (
        <FormSection id="jarmu-hozzarendeles" title="Jármű hozzárendelés" columns={2}>
          <FormField
            as="select"
            icon={PiTruckLight}
            label="Elsődleges kamion"
            name="kamion"
            value={sofor.kamion || ""}
            onChange={handleInputChange}
          >
            <option value="">Nincs hozzárendelve</option>
            {kamionok.map((k) => (
              <option key={k.id} value={k.id}>
                {k.tipus ? `${k.rendszam} (${k.tipus})` : k.rendszam}
              </option>
            ))}
          </FormField>
          <FormField
            as="select"
            icon={PiTruckTrailerLight}
            label="Elsődleges pótkocsi"
            name="aktiv_potkocsi"
            value={sofor.aktiv_potkocsi || ""}
            onChange={handleInputChange}
          >
            <option value="">Nincs hozzárendelve</option>
            {potkocsik.map((p) => (
              <option key={p.id} value={p.id}>
                {p.tipus ? `${p.rendszam} (${p.tipus})` : p.rendszam}
              </option>
            ))}
          </FormField>
          <p className="md:col-span-2 text-xs text-ink-500">
            A sofőr innentől ezt látja aktív járműként — más kamionra/pótkocsira csak kérést küldhet,
            amit itt, a jármű-váltási kérések között hagyhatsz jóvá.
          </p>
        </FormSection>
      )}

      {sofor.id && isOwnerAdmin && (
        <FormSection id="berezes" title="Bérezés" columns={2}>
          <FormField
            icon={PiWalletLight}
            type="number"
            label="Havi bérezés (Ft)"
            name="ber"
            value={sofor.ber ?? ""}
            onChange={handleInputChange}
            placeholder="pl. 450000"
          />
          <p className="md:col-span-2 text-xs text-ink-500">
            Csak te látod — ez a Pénzforgalom oldalon minden hónapban
            automatikusan megjelenik "Fizetés" kiadásként.
          </p>
        </FormSection>
      )}

      <div className="flex justify-end border-t border-ink-100 pt-4">
        <SaveButton
          onClick={handleSubmit}
          isSaving={isSaving}
          label={sofor.id ? "Mentés" : "Új sofőr rögzítése"}
        />
      </div>
    </form>
  );
};

CardSoforAdatokForm.propTypes = {
  sofor: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
};

export default CardSoforAdatokForm;
