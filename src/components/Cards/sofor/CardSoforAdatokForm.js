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
  FaSave,
} from "react-icons/fa";

const CardSoforAdatokForm = ({ sofor, setFormData, handleSave }) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
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
        value={value || ""}
        onChange={handleInputChange}
        className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
        required={required}
        {...props}
      />
    </div>
  );

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6  rounded-lg bg-white border-0">
      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-auto px-4 lg:px-10 py-10">
        {/* User Data Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            Felhasználó adatok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-6/12 px-2">
              <InputField
                icon={FaUser}
                label="Név"
                name="name"
                value={sofor.name}
                required
              />
            </div>
            <div className="w-full lg:w-6/12 px-2">
              <InputField
                icon={FaEnvelope}
                label="Email cím"
                name="email"
                type="email"
                value={sofor.email}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaPhone}
                label="Telefonszám"
                name="phone"
                type="tel"
                value={sofor.phone}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaBirthdayCake}
                label="Születési dátum"
                name="szul_datum"
                type="date"
                value={sofor.szul_datum}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaIdCard}
                label="Személyigazolvány szám"
                name="szemelyi"
                value={sofor.szemelyi}
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Contact Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            Kapcsolat
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaCity}
                label="Város"
                name="varos"
                value={sofor.varos}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaFileAlt}
                label="IRSZ"
                name="irsz"
                value={sofor.irsz}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaHome}
                label="Cím"
                name="cim"
                value={sofor.cim}
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Documents Section */}
        <div>
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            Dokumentumok lejárati dátumai
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaIdCard}
                label="Személyigazolvány lejárat"
                name="szemelyi_lejarat"
                type="date"
                value={sofor.szemelyi_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaCar}
                label="Jogosítvány lejárat"
                name="jogsi_lejarat"
                type="date"
                value={sofor.jogsi_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaShieldAlt}
                label="GKI lejárat"
                name="gki_lejarat"
                type="date"
                value={sofor.gki_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaTruck}
                label="ADR lejárat"
                name="adr_lejarat"
                type="date"
                value={sofor.adr_lejarat}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

CardSoforAdatokForm.propTypes = {
  sofor: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
};

export default CardSoforAdatokForm;
