import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Valódi, a szikora-transz.hu domainhez regisztrált Turnstile site key
// (dash.cloudflare.com → Turnstile) — nem titok, ezért hardcode-olva, ugyanaz
// a minta, mint az `authHash` a `fetchAction.js`-ben. Szándékosan NEM
// build-time env-változóból (`REACT_APP_...`) jön: az egy könnyen elfelejthető
// extra lépés lenne éles build előtt (CRA az ilyen env-változókat build-time
// inline-olja, egy szerver-oldali `.env`-módosítás a már lefordított
// bundle-ön nem változtat) — élesben pont ez okozta, hogy a widget a
// Cloudflare "Csak tesztelésre" figyelmeztetését mutatta a secret key
// frissítése UTÁN is, mert a site key még mindig a teszt-kulcs volt a
// bundle-ben.
const SITE_KEY = "0x4AAAAAAESvs0BzwB0dWm3P";

let scriptLoadingPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

// A publikus ajánlatkérő/jelentkezés formok bot-védelme. `onVerify(token)`
// minden sikeres megoldáskor (és lejáráskor/hibánál üres string-gel) fut —
// a hívó ezt küldi el a backendnek `turnstileToken` mezőként, ami a
// `ApiHandler::verifyTurnstile()` szerver-oldali ellenőrzés bemenete.
// `ref.reset()` szükséges sikeres beküldés után, mert egy Turnstile-token
// csak egyszer használható fel — enélkül a form második beküldése mindig
// elbukna a szerver-oldali ellenőrzésen.
//
// `onVerify`/`onExpire` szándékosan ref-be kerül, nem `useEffect` függőségbe
// — a hívó komponensek minden renderen új arrow function-t adnak át, ami
// enélkül a widgetet minden renderkor eltávolítaná/újra-renderelné.
const Turnstile = forwardRef(function Turnstile({ onVerify, onExpire }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => {
            onVerifyRef.current("");
            if (onExpireRef.current) onExpireRef.current();
          },
          "error-callback": () => onVerifyRef.current(""),
        });
      })
      .catch(() => {
        // Ha a szkript nem tölt be (pl. blokkolt hálózat), a token üres
        // marad — a submit gomb enélkül végig letiltva marad, a form
        // nem beküldhető, de legalább nem dob JS hibát.
      });
    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  return <div ref={containerRef} />;
});

export default Turnstile;
