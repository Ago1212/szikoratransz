import React, { useState } from "react";

export default function CardSoforAdatokForm({
  sofor,
  setFormData,
  handleSave,
}) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };
  return (
    <form onSubmit={handleSave}>
      {/* Felhasználó adatok */}
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Felhasználó adatok
      </h6>
      <div className="flex flex-wrap">
        <InputField
          label="Név"
          name="name"
          value={sofor.name || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Email cím"
          name="email"
          type="email"
          value={sofor.email || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Telefonszám"
          name="phone"
          type="tel"
          value={sofor.phone || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Születési dátum"
          name="szul_datum"
          type="date"
          value={sofor.szul_datum || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Személyigazolvány szám"
          name="szemelyi"
          value={sofor.szemelyi || ""}
          onChange={handleInputChange}
        />
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />

      {/* Kapcsolat */}
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Kapcsolat
      </h6>
      <div className="flex flex-wrap">
        <InputField
          label="Város"
          name="varos"
          value={sofor.varos || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="IRSZ"
          name="irsz"
          value={sofor.irsz || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Cím"
          name="cim"
          value={sofor.cim || ""}
          onChange={handleInputChange}
        />
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />

      {/* Iratok */}
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Iratok
      </h6>
      <div className="flex flex-wrap">
        <InputField
          label="Személyigazolvány lejárati dátum"
          name="szemelyi_lejarat"
          type="date"
          value={sofor.szemelyi_lejarat || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Jogosítvány lejárati dátum"
          name="jogsi_lejarat"
          type="date"
          value={sofor.jogsi_lejarat || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Gki lejárati dátum"
          name="gki_lejarat"
          type="date"
          value={sofor.gki_lejarat || ""}
          onChange={handleInputChange}
        />
        <InputField
          label="Adr lejárati dátum"
          name="adr_lejarat"
          type="date"
          value={sofor.adr_lejarat || ""}
          onChange={handleInputChange}
        />
      </div>
    </form>
  );
}

const InputField = ({ label, name, type = "text", value, onChange }) => (
  <div className="w-full lg:w-6/12 px-4">
    <div className="relative w-full mb-3">
      <label
        className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
        htmlFor={name}
      >
        {label}
      </label>
      <input
        type={type}
        name={name}
        id={name}
        className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
        value={value}
        onChange={onChange}
      />
    </div>
  </div>
);
