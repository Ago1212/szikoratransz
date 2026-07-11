import React, { useEffect, useRef, useState } from "react";
import { PiQrCodeLight, PiXLight } from "react-icons/pi";
import { toast } from "utils/toast";

// Kamera-alapú QR-kód beolvasó a jármű-kiválasztó oldalakhoz — a
// `BarcodeDetector` böngésző-API-t használja (Chrome/Android), mert
// nincs szükség külön könyvtárra hozzá. Ahol nem támogatott (pl. iOS
// Safari), egyszerű üzenettel jelezzük, hogy a keresőmező használható
// helyette — NFC-hez ma nincs webes API, ott is ez marad a fallback.
export default function QrScanButton({ onResult, label = "QR" }) {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const stop = () => {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    if (!("BarcodeDetector" in window)) {
      toast.error("A QR-beolvasás ezen az eszközön nem támogatott — használd a keresőt.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            stop();
            onResult(value);
            return;
          }
        } catch (e) {
          // egy sikertelen frame nem hiba, próbáljuk tovább
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      toast.error("Nincs hozzáférés a kamerához.");
      stop();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
        aria-label="QR-kód beolvasása"
      >
        <PiQrCodeLight className="h-5 w-5" />
      </button>

      {scanning && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <p className="text-sm font-semibold text-white">{label}</p>
            <button
              type="button"
              onClick={stop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Bezárás"
            >
              <PiXLight className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-2xl border-2 border-white/80" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
