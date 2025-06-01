import React, { useState } from "react";
import { fetchAction } from "utils/fetchAction";
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

export default function CardSettings() {
  const storedUserData = sessionStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  const [userData, setUserData] = useState(initialUserData);
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await fetchAction("saveAdminData", {
        id: userData.id,
        ...userData,
      });

      if (result?.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));
        alert("Adatok sikeresen mentve!");
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-0">
      {/* Header */}
      <div className="rounded-t-lg bg-blue-600 mb-0 px-6 py-4">
        <div className="flex justify-between items-center">
          <h6 className="text-white text-xl font-bold flex items-center">
            <FaUser className="inline mr-2" />
            Saját adatok
          </h6>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`bg-white text-blue-600 font-bold uppercase text-xs px-4 py-2 rounded shadow hover:shadow-md outline-none focus:outline-none mr-1 ease-linear transition-all duration-150 flex items-center ${
              isSaving ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Mentés...
              </>
            ) : (
              "Mentés"
            )}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-auto px-4 lg:px-10 py-10">
        {/* User Data Section */}
        <div className="mb-8">
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            Felhasználó adatok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-6/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaUser className="mr-2 text-blue-500" />
                  Név
                </label>
                <input
                  type="text"
                  name="name"
                  value={userData.name || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.email || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.phone || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.szul_datum || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.szemelyi || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
                />
              </div>
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
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaCity className="mr-2 text-blue-500" />
                  Város
                </label>
                <input
                  type="text"
                  name="varos"
                  value={userData.varos || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.irsz || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.cim || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />

        {/* Documents Section */}
        <div>
          <h6 className="text-gray-500 text-sm mb-4 font-bold uppercase flex items-center">
            Iratok
          </h6>
          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-3/12 px-2">
              <div className="relative w-full mb-4">
                <label className="uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
                  <FaIdCard className="mr-2 text-blue-500" />
                  Személyigazolvány lejárat
                </label>
                <input
                  type="date"
                  name="szemelyi_lejarat"
                  value={userData.szemelyi_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.jogsi_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.gki_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
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
                  value={userData.adr_lejarat || ""}
                  onChange={handleInputChange}
                  className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
