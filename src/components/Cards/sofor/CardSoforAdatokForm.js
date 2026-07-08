import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaBirthdayCake,
  FaIdCard,
  FaCity,
  FaHome,
  FaFileAlt,
  FaCar,
  FaShieldAlt,
  FaTruck,
} from "react-icons/fa";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";

const CardSoforAdatokForm = ({ sofor, setFormData, handleSave }) => {
  const [isSaving, setIsSaving] = useState(false);

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
          icon={FaUser}
          label="Név"
          name="name"
          value={sofor.name || ""}
          onChange={handleInputChange}
          required
          className="md:col-span-2"
        />
        <FormField
          icon={FaEnvelope}
          label="Email cím"
          type="email"
          name="email"
          value={sofor.email || ""}
          onChange={handleInputChange}
          className="md:col-span-2"
        />
        <FormField
          icon={FaPhone}
          label="Telefonszám"
          type="tel"
          name="phone"
          value={sofor.phone || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaBirthdayCake}
          label="Születési dátum"
          type="date"
          name="szul_datum"
          value={sofor.szul_datum || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaIdCard}
          label="Személyigazolvány szám"
          name="szemelyi"
          value={sofor.szemelyi || ""}
          onChange={handleInputChange}
        />
      </FormSection>

      <FormSection id="kapcsolat" title="Kapcsolat" columns={3}>
        <FormField
          icon={FaCity}
          label="Város"
          name="varos"
          value={sofor.varos || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaFileAlt}
          label="IRSZ"
          name="irsz"
          value={sofor.irsz || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaHome}
          label="Cím"
          name="cim"
          value={sofor.cim || ""}
          onChange={handleInputChange}
        />
      </FormSection>

      <FormSection id="dokumentumok" title="Dokumentumok lejárati dátumai" columns={4}>
        <FormField
          icon={FaIdCard}
          label="Személyi lejárat"
          type="date"
          name="szemelyi_lejarat"
          value={sofor.szemelyi_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaCar}
          label="Jogosítvány lejárat"
          type="date"
          name="jogsi_lejarat"
          value={sofor.jogsi_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaShieldAlt}
          label="GKI lejárat"
          type="date"
          name="gki_lejarat"
          value={sofor.gki_lejarat || ""}
          onChange={handleInputChange}
        />
        <FormField
          icon={FaTruck}
          label="ADR lejárat"
          type="date"
          name="adr_lejarat"
          value={sofor.adr_lejarat || ""}
          onChange={handleInputChange}
        />
      </FormSection>

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
