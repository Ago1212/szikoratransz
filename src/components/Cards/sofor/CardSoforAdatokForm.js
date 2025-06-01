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

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 rounded-lg bg-white border-0">
      <form onSubmit={handleSubmit} className="flex-auto px-4 lg:px-10 py-10">
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase">
            Felhasználó adatok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-6/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaUser className="mr-2 text-blue-500" />
                  Név <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={sofor.name || ""}
                  onChange={handleInputChange}
                  required
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>
            <div className="w-full lg:w-6/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaEnvelope className="mr-2 text-blue-500" />
                  Email cím
                </label>
                <input
                  type="email"
                  name="email"
                  value={sofor.email || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaPhone className="mr-2 text-blue-500" />
                  Telefonszám
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={sofor.phone || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaBirthdayCake className="mr-2 text-blue-500" />
                  Születési dátum
                </label>
                <input
                  type="date"
                  name="szul_datum"
                  value={sofor.szul_datum || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaIdCard className="mr-2 text-blue-500" />
                  Személyigazolvány szám
                </label>
                <input
                  type="text"
                  name="szemelyi"
                  value={sofor.szemelyi || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase">
            Kapcsolat
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaCity className="mr-2 text-blue-500" />
                  Város
                </label>
                <input
                  type="text"
                  name="varos"
                  value={sofor.varos || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaFileAlt className="mr-2 text-blue-500" />
                  IRSZ
                </label>
                <input
                  type="text"
                  name="irsz"
                  value={sofor.irsz || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-4/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaHome className="mr-2 text-blue-500" />
                  Cím
                </label>
                <input
                  type="text"
                  name="cim"
                  value={sofor.cim || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        <div>
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase">
            Dokumentumok lejárati dátumai
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaIdCard className="mr-2 text-blue-500" />
                  Személyi lejárat
                </label>
                <input
                  type="date"
                  name="szemelyi_lejarat"
                  value={sofor.szemelyi_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaCar className="mr-2 text-blue-500" />
                  Jogosítvány lejárat
                </label>
                <input
                  type="date"
                  name="jogsi_lejarat"
                  value={sofor.jogsi_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaShieldAlt className="mr-2 text-blue-500" />
                  GKI lejárat
                </label>
                <input
                  type="date"
                  name="gki_lejarat"
                  value={sofor.gki_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
            </div>

            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaTruck className="mr-2 text-blue-500" />
                  ADR lejárat
                </label>
                <input
                  type="date"
                  name="adr_lejarat"
                  value={sofor.adr_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
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
