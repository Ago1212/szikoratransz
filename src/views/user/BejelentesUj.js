import React, { useEffect, useRef, useState } from "react";
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
  PiGearLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { fileToBase64 } from "utils/fileToBase64.js";
import { useListaElemek } from "utils/useListaElemek.js";
import MobileHeader from "components/UI/MobileHeader.js";
import SaveButton from "components/UI/SaveButton.js";
import { elokeszitFeltoltesre } from "utils/feltoltesElokeszites.js";

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
  szerviz: PiGearLight,
  felszereles: PiToolboxLight,
  rakomany: PiPackageLight,
  egyeb: PiDotsThreeLight,
};

const REJECTED_TIPUSOK = ["serules", "baleset"];

const ALAP_TIPUSOK = [
  { kulcs: "muszaki", nev: "Műszaki" },
  { kulcs: "gumi", nev: "Gumi" },
  { kulcs: "szerviz", nev: "Szerviz" },
  { kulcs: "felszereles", nev: "Felszerelés" },
  { kulcs: "rakomany", nev: "Rakomány" },
  { kulcs: "egyeb", nev: "Egyéb" },
];

const VAZLAT_KULCS = (userId) => `sofor_bejelentes_vazlat_${userId}`;

function VoiceRecorder({ onRecorded, recording, setRecording }) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      toast.error("Nincs hozzáférés a mikrofonhoz. Engedélyezd a mikrofont a böngésző beállításaiban.");
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
      className={`flex min-h-[4.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border py-3 text-xs font-semibold ${
        recording ? "border-red-300 bg-red-50 text-red-600" : "border-dashed border-ink-200 bg-white text-ink-600"
      }`}
    >
      {recording ? <PiStopCircleLight className="h-6 w-6" /> : <PiMicrophoneLight className="h-6 w-6" />}
      {recording ? "Leállítás" : "Hang"}
    </button>
  );
}

function CsatolmanyChip({ felirat, onRemove, removeLabel }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-0.5 text-xs text-ink-700">
      <span className="max-w-[12rem] truncate">{felirat}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 active:bg-slate-200"
      >
        <PiXLight className="h-4 w-4" />
      </button>
    </span>
  );
}

function hangKiterjesztes(blob) {
  const t = blob?.type || "";
  if (t.includes("mp4") || t.includes("aac")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

export default function BejelentesUj() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const vazlat = (() => {
    try {
      return JSON.parse(localStorage.getItem(VAZLAT_KULCS(user?.id)) || "null") || {};
    } catch (e) {
      return {};
    }
  })();
  const [tipus, setTipus] = useState(vazlat.tipus || null);
  const [leiras, setLeiras] = useState(vazlat.leiras || "");
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [helyHiba, setHelyHiba] = useState(null);
  const [sending, setSending] = useState(false);
  const [letrehozottId, setLetrehozottId] = useState(null);
  const { elemek: TYPES_NYERS, loading: tipusokToltese } = useListaElemek("bejelentes_tipus");
  const szurtTipusok = TYPES_NYERS.filter((t) => !REJECTED_TIPUSOK.includes(t.kulcs));
  const TYPES = !tipusokToltese && szurtTipusok.length === 0 ? ALAP_TIPUSOK : szurtTipusok;

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (tipus || leiras) {
        localStorage.setItem(VAZLAT_KULCS(user.id), JSON.stringify({ tipus, leiras }));
      } else {
        localStorage.removeItem(VAZLAT_KULCS(user.id));
      }
    } catch (e) {
      // localStorage nem elérhető
    }
  }, [tipus, leiras, user?.id]);

  const captureLocation = (csendes = false) => {
    if (!navigator.geolocation) {
      if (!csendes) toast.error("A helymeghatározás nem támogatott ezen az eszközön.");
      return;
    }
    setLocating(true);
    setHelyHiba(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setHelyHiba(
          err?.code === 1
            ? "A helyhozzáférés le van tiltva. Engedélyezd a böngésző / telefon beállításaiban, ha rögzíteni szeretnéd a helyet."
            : "Nem sikerült lekérni a helyzetet. Próbáld újra, vagy küldd el hely nélkül.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  };

  useEffect(() => {
    captureLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valasztottFajl = async (e, setter) => {
    const eredeti = e.target.files?.[0];
    e.target.value = "";
    if (!eredeti) return;
    const { file, hiba } = await elokeszitFeltoltesre(eredeti);
    if (hiba) {
      toast.error(hiba);
      return;
    }
    setter(file);
  };

  const uploadAttachment = async (bejelentesId, file, name, kategoria) => {
    const base64 = await fileToBase64(file);
    const result = await fetchAction(
      "fileUpload",
      { admin: user.admin, id: bejelentesId, tabla: "bejelentesek", file: base64, name, size: file.size, kategoria },
      { timeoutMs: 120000 },
    );
    return { name, ok: Boolean(result?.success), message: result?.message };
  };

  const handleSend = async () => {
    if (!tipus) {
      toast.error("Válassz típust!");
      return;
    }
    if (recording) {
      toast.error("Előbb állítsd le a hangfelvételt.");
      return;
    }
    setSending(true);
    try {
      let bejelentesId = letrehozottId;
      if (!bejelentesId) {
        const typeLabel = TYPES.find((t) => t.kulcs === tipus)?.nev || "Bejelentés";
        const result = await fetchAction("newBejelentes", {
          admin: user.admin,
          sofor_id: user.id,
          kamion_id: user.kamion || null,
          tipus,
          cim: typeLabel,
          leiras: leiras.trim() || typeLabel,
          // A backend `prioritas` mezője NEM kötelező — üres érték esetén a
          // `bejelentesekInterface::newBejelentes()` "kozepes"-re állítja.
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        });
        if (!result?.success) {
          throw new Error(result?.message || "A bejelentés küldése sikertelen.");
        }
        bejelentesId = result.id;
        setLetrehozottId(bejelentesId);
      }

      const uploads = [];
      if (photo) uploads.push(uploadAttachment(bejelentesId, photo, photo.name, "foto"));
      if (video) uploads.push(uploadAttachment(bejelentesId, video, video.name, "video"));
      if (audioBlob) uploads.push(uploadAttachment(bejelentesId, audioBlob, `hangfelvetel.${hangKiterjesztes(audioBlob)}`, "hang"));
      const eredmenyek = await Promise.all(uploads);
      const sikertelen = eredmenyek.filter((r) => !r.ok);

      eredmenyek.filter((r) => r.ok).forEach((r) => {
        if (photo && r.name === photo.name) setPhoto(null);
        if (video && r.name === video.name) setVideo(null);
        if (r.name.startsWith("hangfelvetel.")) setAudioBlob(null);
      });

      if (sikertelen.length > 0) {
        toast.error(
          `A bejelentés elment, de ${sikertelen.length === 1 ? "egy csatolmány" : `${sikertelen.length} csatolmány`} nem töltődött fel (${sikertelen
            .map((r) => r.name)
            .join(", ")}). Nyomd meg újra a Küldést a csatolmányok újrapróbálásához.`,
        );
        return;
      }

      try {
        localStorage.removeItem(VAZLAT_KULCS(user.id));
      } catch (e) {
        // localStorage nem elérhető
      }
      toast.success("Bejelentés elküldve!");
      history.push("/user/bejelentesek");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Új bejelentés" />

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Mi történt?</h2>
        {tipusokToltese ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Bejelentés típusa">
            {TYPES.map((t) => {
              const active = tipus === t.kulcs;
              const Icon = TYPE_ICONS[t.kulcs] || PiDotsThreeLight;
              return (
                <button
                  key={t.kulcs}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setTipus(t.kulcs);
                    toast.clear();
                  }}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-sm font-semibold leading-tight ${
                    active ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200" : "border-ink-100 bg-white text-ink-700"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {t.nev}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <textarea
        value={leiras}
        onChange={(e) => setLeiras(e.target.value)}
        placeholder="Rövid leírás a történtekről (opcionális)…"
        rows={3}
        className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-3 text-base text-ink-900 placeholder-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="flex min-h-[4.25rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-200 bg-white py-3 text-xs font-semibold text-ink-600">
          <PiCameraLight className="h-6 w-6" />
          {photo ? "Fotó kész" : "Fotó"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => valasztottFajl(e, setPhoto)} />
        </label>
        <label className="flex min-h-[4.25rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-200 bg-white py-3 text-xs font-semibold text-ink-600">
          <PiVideoCameraLight className="h-6 w-6" />
          {video ? "Videó kész" : "Videó"}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => valasztottFajl(e, setVideo)} />
        </label>
        <VoiceRecorder recording={recording} setRecording={setRecording} onRecorded={setAudioBlob} />
      </div>
      {(photo || video || audioBlob) && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {photo && <CsatolmanyChip felirat={photo.name} onRemove={() => setPhoto(null)} removeLabel="Fotó eltávolítása" />}
          {video && <CsatolmanyChip felirat={video.name} onRemove={() => setVideo(null)} removeLabel="Videó eltávolítása" />}
          {audioBlob && <CsatolmanyChip felirat="Hangfelvétel" onRemove={() => setAudioBlob(null)} removeLabel="Hangfelvétel eltávolítása" />}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => captureLocation(false)}
          disabled={locating}
          className={`flex min-h-11 w-fit items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${
            location ? "bg-emerald-50 text-emerald-700" : "border border-ink-100 bg-white text-ink-600"
          }`}
        >
          {location ? <PiCheckCircleFill className="h-5 w-5" /> : <PiMapPinLight className="h-5 w-5" />}
          {locating ? "Helyzet lekérése…" : location ? "Helyzet rögzítve" : "Helyzet rögzítése"}
        </button>
        {helyHiba && !location && <p className="mt-1.5 text-sm text-ink-500">{helyHiba}</p>}
      </div>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-slate-50/95 px-4 pb-2 pt-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
        <SaveButton
          onClick={handleSend}
          isSaving={sending}
          label={letrehozottId ? "Csatolmányok újraküldése" : "Bejelentés küldése"}
          savingLabel="Küldés…"
          className="w-full justify-center py-3.5"
        />
      </div>
    </div>
  );
}
