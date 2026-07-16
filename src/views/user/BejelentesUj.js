import React, { useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiWrenchLight,
  PiTireLight,
  PiToolboxLight,
  PiPackageLight,
  PiDotsThreeLight,
  PiCameraLight,
  PiVideoCameraLight,
  PiMicrophoneLight,
  PiStopCircleLight,
  PiMapPinLight,
  PiCheckCircleFill,
  PiXLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { fileToBase64 } from "utils/fileToBase64.js";
import { useListaElemek } from "utils/useListaElemek.js";
import MobileHeader from "components/UI/MobileHeader.js";
import SaveButton from "components/UI/SaveButton.js";

// Az eredeti 8 típushoz tartozó ikonok megmaradnak, egy admin által
// hozzáadott egyéni típus pedig az általános PiDotsThreeLight ikont kapja
// (ld. views/admin/Listak.js — a típusok listája mostantól bővíthető).
//
// "Sérülés"/"Baleset" SZÁNDÉKOSAN nincs a lenti térképben — felhasználói
// kérésre a sofőr-oldali bejelentés-létrehozásból eltávolítva (ld.
// REJECTED_TIPUSOK lent), gyorsabb/egyszerűbb választást adva. Az admin-
// oldali `listaelemek` sorokat és a meglévő, már ezekkel a típusokkal
// létrehozott bejelentéseket ez nem érinti — csak az ÚJ bejelentés
// típus-választója szűri ki őket.
const TYPE_ICONS = {
  muszaki: PiWrenchLight,
  gumi: PiTireLight,
  szerviz: PiWrenchLight,
  felszereles: PiToolboxLight,
  rakomany: PiPackageLight,
  egyeb: PiDotsThreeLight,
};

const REJECTED_TIPUSOK = ["serules", "baleset"];

function VoiceRecorder({ onRecorded, recording, setRecording }) {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      toast.error("Nincs hozzáférés a mikrofonhoz.");
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 text-[11px] font-semibold ${
        recording ? "border-red-300 bg-red-50 text-red-600" : "border-dashed border-ink-200 text-ink-500"
      }`}
    >
      {recording ? <PiStopCircleLight className="h-5 w-5" /> : <PiMicrophoneLight className="h-5 w-5" />}
      {recording ? "Felvétel leállítása" : "Hang"}
    </button>
  );
}

export default function BejelentesUj() {
  const history = useHistory();
  const [tipus, setTipus] = useState(null);
  const [leiras, setLeiras] = useState("");
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [sending, setSending] = useState(false);
  const { elemek: TYPES_NYERS } = useListaElemek("bejelentes_tipus");
  const TYPES = TYPES_NYERS.filter((t) => !REJECTED_TIPUSOK.includes(t.kulcs));

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("A helymeghatározás nem támogatott ezen az eszközön.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Nem sikerült lekérni a helyzetet.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const uploadAttachment = async (admin, bejelentesId, file, name, kategoria) => {
    const base64 = await fileToBase64(file);
    await fetchAction("fileUpload", {
      admin,
      id: bejelentesId,
      tabla: "bejelentesek",
      file: base64,
      name,
      size: file.size,
      kategoria,
    });
  };

  const handleSend = async () => {
    if (!tipus) {
      toast.error("Válassz típust!");
      return;
    }
    const user = JSON.parse(sessionStorage.getItem("user"));
    setSending(true);
    try {
      const typeLabel = TYPES.find((t) => t.kulcs === tipus)?.nev || "Bejelentés";
      const result = await fetchAction("newBejelentes", {
        admin: user.admin,
        sofor_id: user.id,
        kamion_id: user.kamion || null,
        tipus,
        cim: typeLabel,
        leiras: leiras.trim() || typeLabel,
        // A backend `prioritas` mezője NEM kötelező (ld. ApiHandler.php
        // `getActions()`) — üres/hiányzó érték esetén a
        // `bejelentesekInterface::newBejelentes()` automatikusan
        // "kozepes"-re állítja. A sofőr-oldali létrehozás felhasználói
        // kérésre szándékosan nem kérdez rá — egy adminisztrátor a
        // bejelentés admin-oldali szerkesztésekor tudja állítani, ha
        // szükséges.
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      });

      if (!result?.success) {
        throw new Error(result?.message || "A bejelentés küldése sikertelen.");
      }

      const bejelentesId = result.id;
      const uploads = [];
      if (photo) uploads.push(uploadAttachment(user.admin, bejelentesId, photo, photo.name, "foto"));
      if (video) uploads.push(uploadAttachment(user.admin, bejelentesId, video, video.name, "video"));
      if (audioBlob) uploads.push(uploadAttachment(user.admin, bejelentesId, audioBlob, "hangfelvetel.webm", "hang"));
      await Promise.all(uploads);

      toast.success("Bejelentés elküldve!");
      history.push("/user/bejelentesek");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 md:pb-20">
      <MobileHeader title="Új bejelentés" />

      <div>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Mi történt?</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {TYPES.map((t) => {
            const active = tipus === t.kulcs;
            const Icon = TYPE_ICONS[t.kulcs] || PiDotsThreeLight;
            return (
              <button
                key={t.kulcs}
                type="button"
                onClick={() => setTipus(t.kulcs)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-[10px] font-semibold leading-tight ${
                  active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-ink-100 bg-white text-ink-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.nev}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        value={leiras}
        onChange={(e) => setLeiras(e.target.value)}
        placeholder="Rövid leírás a történtekről (opcionális)…"
        rows={2}
        className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-ink-200 py-3 text-[11px] font-semibold text-ink-500">
          <PiCameraLight className="h-5 w-5" />
          {photo ? "Fotó kész" : "Fotó"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files[0] || null)}
          />
        </label>
        <label className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-ink-200 py-3 text-[11px] font-semibold text-ink-500">
          <PiVideoCameraLight className="h-5 w-5" />
          {video ? "Videó kész" : "Videó"}
          <input
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setVideo(e.target.files[0] || null)}
          />
        </label>
        <VoiceRecorder recording={recording} setRecording={setRecording} onRecorded={setAudioBlob} />
      </div>
      {(photo || video || audioBlob) && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {photo && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-ink-600">
              {photo.name} <button type="button" onClick={() => setPhoto(null)}><PiXLight className="h-3 w-3" /></button>
            </span>
          )}
          {video && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-ink-600">
              {video.name} <button type="button" onClick={() => setVideo(null)}><PiXLight className="h-3 w-3" /></button>
            </span>
          )}
          {audioBlob && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-ink-600">
              Hangfelvétel <button type="button" onClick={() => setAudioBlob(null)}><PiXLight className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={captureLocation}
        disabled={locating}
        className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
          location ? "bg-emerald-50 text-emerald-700" : "bg-white border border-ink-100 text-ink-500"
        }`}
      >
        {location ? <PiCheckCircleFill className="h-4 w-4" /> : <PiMapPinLight className="h-4 w-4" />}
        {locating ? "Helyzet lekérése…" : location ? "Helyzet rögzítve" : "Helyzet rögzítése"}
      </button>

      {/* Rögzített gomb a lap alján, a mobil alsó navigáció fölött —
          korábban a form aljára volt szerelve, hosszabb tartalomnál
          (pl. sok csatolmány) csak legörgetve látszott. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-100 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-lg md:max-w-3xl">
          <SaveButton
            onClick={handleSend}
            isSaving={sending}
            label="Bejelentés küldése"
            savingLabel="Küldés…"
            className="w-full justify-center py-3.5"
          />
        </div>
      </div>
    </div>
  );
}
