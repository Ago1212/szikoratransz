import React, { useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import {
  PiUserLight,
  PiEnvelopeSimpleLight,
  PiPhoneLight,
  PiCakeLight,
  PiIdentificationCardLight,
  PiBuildingsLight,
  PiMailboxLight,
  PiHouseLineLight,
  PiCarLight,
  PiShieldCheckLight,
  PiTruckLight,
  PiIdentificationBadgeLight,
  PiReceiptLight,
  PiKeyLight,
  PiMapTrifoldLight,
  PiHashLight,
} from "react-icons/pi";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import FormField, { FormSection } from "components/UI/FormField.js";

export default function CardSettings() {
  const storedUserData = localStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  const [userData, setUserData] = useState(initialUserData);
  const [isSaving, setIsSaving] = useState(false);
  // A szerepkörök cégenként egyénileg bővíthetők (ld. Jogosultsagok.js) —
  // a megjelenítendő nevet ezért a cég szerepkör-listájából kell kikeresni,
  // nem egy fix, kódba égetett címke-térképből.
  const [szerepkorNev, setSzerepkorNev] = useState(
    initialUserData.szerepkor === "admin" ? "Adminisztrátor" : initialUserData.szerepkor || ""
  );

  useEffect(() => {
    if (!initialUserData.ceg_id) return;
    fetchAction("getSzerepkorok", { id: initialUserData.ceg_id }).then((result) => {
      if (result?.success) {
        const talalt = (result.szerepkorok || []).find((r) => r.kulcs === initialUserData.szerepkor);
        if (talalt) setSzerepkorNev(talalt.nev);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A NAV Online Számla kapcsolat cégszintű, érzékeny beállítás — csak a
  // cég tulajdonos-adminja láthatja/módosíthatja, nem minden csapattag.
  // A titkos mezőket (jelszó/kulcsok) a szerver SOSEM adja vissza
  // visszafejtve — csak azt jelzi, van-e már beállítva kapcsolat; a mezők
  // üresen maradnak, "•••• (mentve)" placeholderrel jelezve, hogy van
  // mentett érték, amit csak akkor írunk felül, ha ténylegesen új
  // szöveget gépel bele a felhasználó.
  const isOwnerAdmin = initialUserData.szerepkor === "admin";
  const [navVanBeallitva, setNavVanBeallitva] = useState(false);
  const [navForm, setNavForm] = useState({
    adoszam: "",
    login: "",
    jelszo: "",
    alairoKulcs: "",
    csereKulcs: "",
    kornyezet: "eles",
  });
  const [isNavSaving, setIsNavSaving] = useState(false);

  useEffect(() => {
    if (!isOwnerAdmin || !initialUserData.ceg_id) return;
    fetchAction("getNavSzamlaBeallitasokStatusz", {
      ceg_id: initialUserData.ceg_id,
      kerelmezo_id: initialUserData.id,
    }).then((result) => {
      if (result?.success && result.van_beallitva) {
        setNavVanBeallitva(true);
        setNavForm((prev) => ({
          ...prev,
          adoszam: result.adoszam || "",
          login: result.login || "",
          kornyezet: result.kornyezet || "eles",
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavInputChange = (e) => {
    const { name, value } = e.target;
    setNavForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNavSave = async () => {
    if (!navForm.adoszam.trim() || !navForm.login.trim()) {
      toast.error("Az adószám és a technikai felhasználó login megadása kötelező!");
      return;
    }
    if (!navVanBeallitva && (!navForm.jelszo || !navForm.alairoKulcs || !navForm.csereKulcs)) {
      toast.error("Első alkalommal a jelszó, az aláíró kulcs és a cserekulcs megadása is kötelező!");
      return;
    }
    setIsNavSaving(true);
    try {
      const result = await fetchAction("saveNavSzamlaBeallitasok", {
        ceg_id: initialUserData.ceg_id,
        kerelmezo_id: initialUserData.id,
        adoszam: navForm.adoszam.trim(),
        login: navForm.login.trim(),
        jelszo: navForm.jelszo,
        alairoKulcs: navForm.alairoKulcs,
        csereKulcs: navForm.csereKulcs,
        kornyezet: navForm.kornyezet,
      });
      if (result?.success) {
        toast.success("NAV Online Számla beállítások mentve.");
        setNavVanBeallitva(true);
        setNavForm((prev) => ({ ...prev, jelszo: "", alairoKulcs: "", csereKulcs: "" }));
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsNavSaving(false);
    }
  };

  // A GPSmart flottakövetés kapcsolat ugyanaz a minta, mint a NAV Online
  // Számláé: cégszintű, csak a tulajdonos-adminnak látható/módosítható,
  // a jelszót a szerver sosem adja vissza, üresen hagyva a mentett érték
  // megmarad.
  const [gpsmartVanBeallitva, setGpsmartVanBeallitva] = useState(false);
  const [gpsmartForm, setGpsmartForm] = useState({
    felhasznalonev: "",
    jelszo: "",
    userid: "",
  });
  const [isGpsmartSaving, setIsGpsmartSaving] = useState(false);

  useEffect(() => {
    if (!isOwnerAdmin || !initialUserData.ceg_id) return;
    fetchAction("getGpsmartBeallitasokStatusz", {
      ceg_id: initialUserData.ceg_id,
      kerelmezo_id: initialUserData.id,
    }).then((result) => {
      if (result?.success && result.van_beallitva) {
        setGpsmartVanBeallitva(true);
        setGpsmartForm((prev) => ({
          ...prev,
          felhasznalonev: result.felhasznalonev || "",
          userid: result.userid || "",
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGpsmartInputChange = (e) => {
    const { name, value } = e.target;
    setGpsmartForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGpsmartSave = async () => {
    if (!gpsmartForm.felhasznalonev.trim() || !gpsmartForm.userid.trim()) {
      toast.error("A felhasználónév és a UserID megadása kötelező!");
      return;
    }
    if (!gpsmartVanBeallitva && !gpsmartForm.jelszo) {
      toast.error("Első alkalommal a jelszó megadása is kötelező!");
      return;
    }
    setIsGpsmartSaving(true);
    try {
      const result = await fetchAction("saveGpsmartBeallitasok", {
        ceg_id: initialUserData.ceg_id,
        kerelmezo_id: initialUserData.id,
        felhasznalonev: gpsmartForm.felhasznalonev.trim(),
        jelszo: gpsmartForm.jelszo,
        userid: gpsmartForm.userid.trim(),
      });
      if (result?.success) {
        toast.success("GPSmart beállítások mentve.");
        setGpsmartVanBeallitva(true);
        setGpsmartForm((prev) => ({ ...prev, jelszo: "" }));
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsGpsmartSaving(false);
    }
  };

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
        localStorage.setItem("user", JSON.stringify(result.user));
        toast.success("Adatok sikeresen mentve!");
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageCard icon={PiUserLight} title="Saját adatok">
      <div className="px-4 py-6 lg:px-10 lg:py-10">
        <div className="space-y-5">
          <FormSection id="felhasznalo-adatok" title="Felhasználó adatok" columns={4}>
            <FormField
              icon={PiUserLight}
              label="Név"
              name="name"
              value={userData.name || ""}
              onChange={handleInputChange}
              className="md:col-span-2"
            />
            <FormField
              icon={PiEnvelopeSimpleLight}
              label="Email cím"
              type="email"
              name="email"
              value={userData.email || ""}
              onChange={handleInputChange}
              className="md:col-span-2"
            />
            <FormField
              icon={PiPhoneLight}
              label="Telefonszám"
              type="tel"
              name="phone"
              value={userData.phone || ""}
              onChange={handleInputChange}
            />
            <FormField
              as="info"
              icon={PiIdentificationBadgeLight}
              label="Szerepkör"
              value={szerepkorNev}
            />
            <FormField
              icon={PiCakeLight}
              label="Születési dátum"
              type="date"
              name="szul_datum"
              value={userData.szul_datum || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiIdentificationCardLight}
              label="Személyigazolvány szám"
              name="szemelyi"
              value={userData.szemelyi || ""}
              onChange={handleInputChange}
            />
          </FormSection>
          <p className="-mt-2 text-xs text-ink-400 dark:text-ink-500">
            A szerepkör itt csak megtekinthető — módosítani a Felhasználók listáján lehet.
          </p>

          {isOwnerAdmin && (
            <FormSection id="ceg-adatai" title="Cég adatai" icon={PiBuildingsLight} columns={4}>
              <FormField
                icon={PiBuildingsLight}
                label="Cégnév"
                name="cegnev"
                value={userData.cegnev || ""}
                onChange={handleInputChange}
                className="md:col-span-2"
              />
            </FormSection>
          )}

          <FormSection id="kapcsolat" title="Kapcsolat" columns={3}>
            <FormField
              icon={PiBuildingsLight}
              label="Város"
              name="varos"
              value={userData.varos || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiMailboxLight}
              label="IRSZ"
              inputMode="numeric"
              name="irsz"
              value={userData.irsz || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiHouseLineLight}
              label="Cím"
              name="cim"
              value={userData.cim || ""}
              onChange={handleInputChange}
            />
          </FormSection>

          <FormSection id="iratok" title="Iratok" columns={4}>
            <FormField
              icon={PiIdentificationCardLight}
              label="Személyigazolvány lejárat"
              type="date"
              name="szemelyi_lejarat"
              value={userData.szemelyi_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiCarLight}
              label="Jogosítvány lejárat"
              type="date"
              name="jogsi_lejarat"
              value={userData.jogsi_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiShieldCheckLight}
              label="GKI lejárat"
              type="date"
              name="gki_lejarat"
              value={userData.gki_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiTruckLight}
              label="ADR lejárat"
              type="date"
              name="adr_lejarat"
              value={userData.adr_lejarat || ""}
              onChange={handleInputChange}
            />
          </FormSection>

          <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
            <SaveButton onClick={handleSave} isSaving={isSaving} />
          </div>

          {isOwnerAdmin && (
            <div className="border-t border-ink-100 pt-5 dark:border-ink-800">
              <FormSection
                id="nav-szamla"
                title="NAV Online Számla kapcsolat"
                icon={PiReceiptLight}
                columns={3}
              >
                <FormField
                  icon={PiIdentificationCardLight}
                  label="Adószám (csak az első 8 számjegy)"
                  name="adoszam"
                  value={navForm.adoszam}
                  onChange={handleNavInputChange}
                  placeholder="pl. 12345678 (kötőjelek/ellenőrző számok nélkül)"
                />
                <FormField
                  icon={PiUserLight}
                  label="Technikai felhasználó login"
                  name="login"
                  value={navForm.login}
                  onChange={handleNavInputChange}
                />
                <FormField
                  as="select"
                  icon={PiShieldCheckLight}
                  label="Környezet"
                  name="kornyezet"
                  value={navForm.kornyezet}
                  onChange={handleNavInputChange}
                >
                  <option value="eles">Éles</option>
                  <option value="teszt">Teszt</option>
                </FormField>
                <FormField
                  icon={PiKeyLight}
                  label="Jelszó"
                  type="password"
                  name="jelszo"
                  value={navForm.jelszo}
                  onChange={handleNavInputChange}
                  placeholder={navVanBeallitva ? "•••• (mentve — hagyd üresen, ha nem változik)" : ""}
                />
                <FormField
                  icon={PiKeyLight}
                  label="Aláíró kulcs"
                  type="password"
                  name="alairoKulcs"
                  value={navForm.alairoKulcs}
                  onChange={handleNavInputChange}
                  placeholder={navVanBeallitva ? "•••• (mentve — hagyd üresen, ha nem változik)" : ""}
                />
                <FormField
                  icon={PiKeyLight}
                  label="Cserekulcs"
                  type="password"
                  name="csereKulcs"
                  value={navForm.csereKulcs}
                  onChange={handleNavInputChange}
                  placeholder={navVanBeallitva ? "•••• (mentve — hagyd üresen, ha nem változik)" : ""}
                />
              </FormSection>
              <p className="-mt-1 mb-3 text-xs text-ink-400 dark:text-ink-500">
                {navVanBeallitva
                  ? "A kapcsolat be van állítva — a Pénzforgalom oldalon lekérdezheted a NAV-tól a számlákat."
                  : "A technikai felhasználó adatait a NAV Online Számla portálján kell előbb létrehozni."}
              </p>
              <div className="flex justify-end">
                <SaveButton onClick={handleNavSave} isSaving={isNavSaving} />
              </div>
            </div>
          )}

          {isOwnerAdmin && (
            <div className="border-t border-ink-100 pt-5 dark:border-ink-800">
              <FormSection
                id="gpsmart"
                title="GPSmart flottakövetés kapcsolat"
                icon={PiMapTrifoldLight}
                columns={3}
              >
                <FormField
                  icon={PiUserLight}
                  label="Felhasználónév"
                  name="felhasznalonev"
                  value={gpsmartForm.felhasznalonev}
                  onChange={handleGpsmartInputChange}
                />
                <FormField
                  icon={PiKeyLight}
                  label="Jelszó"
                  type="password"
                  name="jelszo"
                  value={gpsmartForm.jelszo}
                  onChange={handleGpsmartInputChange}
                  placeholder={gpsmartVanBeallitva ? "•••• (mentve — hagyd üresen, ha nem változik)" : ""}
                />
                <FormField
                  icon={PiHashLight}
                  label="UserID"
                  name="userid"
                  value={gpsmartForm.userid}
                  onChange={handleGpsmartInputChange}
                  placeholder="a GPSmart oldal linkjében szereplő UserID"
                />
              </FormSection>
              <p className="-mt-1 mb-3 text-xs text-ink-400 dark:text-ink-500">
                {gpsmartVanBeallitva
                  ? "A kapcsolat be van állítva — a Flottakövetés menüpontban megjelennek a kamionok pillanatnyi pozíciói."
                  : "Ugyanazok a belépési adatok, amikkel a flottanavigacio.gpsmart.eu oldalra szoktatok bejelentkezni."}
              </p>
              <div className="flex justify-end">
                <SaveButton onClick={handleGpsmartSave} isSaving={isGpsmartSaving} />
              </div>
            </div>
          )}
        </div>
      </div>
    </PageCard>
  );
}
