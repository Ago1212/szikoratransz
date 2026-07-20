// R52 (fejlesztési audit, 2026-07-19): a WebAuthn böngésző-API
// ArrayBuffer-eket vár/ad vissza, a backend viszont (a JSON-alapú
// fetchAction-mintához illeszkedve) base64url-szöveget — ez a két apró
// segédfüggvény a közös átalakítás mindkét irányba.
export function b64urlToBuf(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = window.atob((str + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return window.btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A "melyik e-mail regisztrált gyors-bejelentkezést EZEN az eszközön" jelző
// szándékosan `localStorage`-ban, a szerveren NEM — ez pusztán a Login.js
// UX-döntése ("mutassuk-e a gyors-bejelentkezés gombot"), nem hitelesítési
// adat; a tényleges biztonságot a hitelesítő saját, eszközön tárolt
// privát kulcsa + a szerver oldali aláírás-ellenőrzés adja.
const STORAGE_KEY = "webauthnEmail";

export function getWebauthnEmail() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function setWebauthnEmail(email) {
  try {
    localStorage.setItem(STORAGE_KEY, email);
  } catch (e) {
    // ignore
  }
}

export function clearWebauthnEmail() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function webauthnTamogatott() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}
