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

  const InputField = ({
    icon: Icon,
    label,
    name,
    type = "text",
    value,
    ...props
  }) => (
    <div className="relative w-full mb-4">
      <label className=" uppercase text-gray-600 text-xs font-bold mb-2 flex items-center">
        <Icon className="mr-2 text-blue-500" />
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={handleInputChange}
        className="border-0 px-3 py-3 placeholder-gray-300 text-gray-700 bg-white rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition duration-200"
        {...props}
      />
    </div>
  );

  return (
    <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-xl rounded-lg bg-white border-0">
      {/* Header */}
      <div className="rounded-t-lg bg-blue-600 mb-0 px-6 py-4">
        <div className="text-center flex justify-between items-center">
          <h6 className="text-white text-xl font-bold">
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
              <InputField
                icon={FaUser}
                label="Név"
                name="name"
                value={userData.name}
              />
            </div>
            <div className="w-full lg:w-6/12 px-2">
              <InputField
                icon={FaEnvelope}
                label="Email cím"
                name="email"
                type="email"
                value={userData.email}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaPhone}
                label="Telefonszám"
                name="phone"
                type="tel"
                value={userData.phone}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaBirthdayCake}
                label="Születési dátum"
                name="szul_datum"
                type="date"
                value={userData.szul_datum}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaIdCard}
                label="Személyigazolvány szám"
                name="szemelyi"
                value={userData.szemelyi}
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
                value={userData.varos}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaFileAlt}
                label="IRSZ"
                name="irsz"
                value={userData.irsz}
              />
            </div>
            <div className="w-full lg:w-4/12 px-2">
              <InputField
                icon={FaHome}
                label="Cím"
                name="cim"
                value={userData.cim}
              />
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
              <InputField
                icon={FaIdCard}
                label="Személyigazolvány lejárat"
                name="szemelyi_lejarat"
                type="date"
                value={userData.szemelyi_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaCar}
                label="Jogosítvány lejárat"
                name="jogsi_lejarat"
                type="date"
                value={userData.jogsi_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaShieldAlt}
                label="GKI lejárat"
                name="gki_lejarat"
                type="date"
                value={userData.gki_lejarat}
              />
            </div>
            <div className="w-full lg:w-3/12 px-2">
              <InputField
                icon={FaTruck}
                label="ADR lejárat"
                name="adr_lejarat"
                type="date"
                value={userData.adr_lejarat}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
