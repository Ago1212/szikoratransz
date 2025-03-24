import React, { useState } from "react";

export default function CardJarmuAdatokForm({
  kamion,
  setFormData,
  handleSave,
}) {
  const formatNumber = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat("hu-HU").format(value);
  };
  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData((prevKamion) => ({
      ...prevKamion,
      [id]: value,
    }));
  };
  return (
    <form onSubmit={handleSave}>
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Fő adatok
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="rendszam"
            >
              Rendszám
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.rendszam}
              id="rendszam"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="potkocsi"
            >
              Pótkocsi
            </label>
            <input
              type="text"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.potkocsi}
              id="potkocsi"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />

      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Lejárati dátumok
      </h6>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="muszaki_lejarat"
            >
              Műszaki
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.muszaki_lejarat}
              id="muszaki_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="adr_lejarat"
            >
              Adr
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.adr_lejarat}
              id="adr_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="taograf_illesztes"
            >
              Taográf illesztés
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.taograf_illesztes}
              id="taograf_illesztes"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="emelohatfal_vizsga"
            >
              Emelő hátfal
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.emelohatfal_vizsga}
              id="emelohatfal_vizsga"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="porolto_lejarat"
            >
              Poroltó #1
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.porolto_lejarat}
              id="porolto_lejarat"
              onChange={handleFormChange}
            />
          </div>
        </div>
        <div className="w-full lg:w-3/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="porolto_lejarat_2"
            >
              Poroltó #2
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.porolto_lejarat_2}
              id="porolto_lejarat_2"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Kötelező biztosítás
      </h6>
      <div className="flex flex-wrap">
        {/* Ütem kiválasztó */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biz_utem"
            >
              Ütem
            </label>
            <select
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kot_biz_utem || ""}
              id="kot_biz_utem"
              onChange={handleFormChange}
            >
              <option value="">Válassz...</option>
              <option value="Nincs">Nincs</option>
              <option value="Negyed év">Negyed év</option>
              <option value="Fél év">Fél év</option>
              <option value="Éves">Éves</option>
            </select>
          </div>
        </div>
        {/* Dátum mező */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biztositas"
            >
              Dátum
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kot_biztositas || ""}
              id="kot_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>

        {/* Díj mező */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kot_biz_dij"
            >
              Díj
            </label>
            <input
              type="number"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kot_biz_dij || ""}
              id="kot_biz_dij"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>

      <hr className="mt-6 border-b-1 border-blueGray-300" />
      <h6 className="text-blueGray-400 text-sm mt-3 mb-6 font-bold uppercase">
        Kaszkó fizetési ütem
      </h6>
      <div className="flex flex-wrap">
        {/* Ütem kiválasztó */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_fizetesi_utem"
            >
              Ütem
            </label>
            <select
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kaszko_fizetesi_utem || ""}
              id="kaszko_fizetesi_utem"
              onChange={handleFormChange}
            >
              <option value="">Válassz...</option>
              <option value="Nincs">Nincs</option>
              <option value="Negyed év">Negyed év</option>
              <option value="Fél év">Fél év</option>
              <option value="Éves">Éves</option>
            </select>
          </div>
        </div>
        {/* Dátum mező */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_biztositas"
            >
              Dátum
            </label>
            <input
              type="date"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kaszko_biztositas || ""}
              id="kaszko_biztositas"
              onChange={handleFormChange}
            />
          </div>
        </div>

        {/* Díj mező */}
        <div className="w-full lg:w-4/12 px-4">
          <div className="relative w-full mb-3">
            <label
              className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
              htmlFor="kaszko_dij"
            >
              Díj
            </label>
            <input
              type="number"
              className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
              value={kamion.kaszko_dij || ""}
              id="kaszko_dij"
              onChange={handleFormChange}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
