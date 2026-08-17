import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare hivatalos, mindig sikeres TESZT site key — csak fejlesztéshez,
// amíg nincs valós Turnstile site kulcs (dash.cloudflare.com → Turnstile,
// a szikora-transz.hu domainhez regisztrálva). ÉLES ELŐTT CSERÉLENDŐ egy
// valódi site key-re, egyébként a widget mindenkinél automatikusan
// sikeresnek fog látszani, valódi bot-védelem nélkül.
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

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
