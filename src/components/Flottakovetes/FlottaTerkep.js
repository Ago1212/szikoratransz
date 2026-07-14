import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  PiPlusLight,
  PiMinusLight,
  PiArrowsOutSimpleLight,
  PiArrowsInSimpleLight,
  PiCrosshairSimpleLight,
} from "react-icons/pi";
import { jarmuIkon } from "./terkepIkon";

// A térkép automatikusan az összes megjelenített jármű pozícióját
// befoglaló nézetre ugrik — csak akkor, ha `aktiv` (ld. FlottaTerkep: nem
// fut újra minden frissítésnél, csak amikor tényleg indokolt, hogy ne
// rántsa el a nézetet a felhasználó kezéből panelezés közben).
function TerkepIllesztes({ dusitett, aktiv }) {
  const map = useMap();
  useEffect(() => {
    if (!aktiv) return;
    const ervenyes = dusitett.filter((p) => p.lat != null && p.lon != null);
    if (ervenyes.length === 0) return;
    const bounds = L.latLngBounds(ervenyes.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv]);
  return null;
}

// "Követés" mód — bekapcsolva a térkép minden frissítésnél a kiválasztott
// jármű aktuális pozíciójára pásztáz, hogy ne kelljen kézzel keresgélni,
// ha a kamion közben elhagyta a látható területet.
function KovetesIllesztes({ dusitett, kivalasztott, kovetesEnabled }) {
  const map = useMap();
  useEffect(() => {
    if (!kovetesEnabled || !kivalasztott) return;
    const jarmu = dusitett.find((p) => p.rendszam === kivalasztott);
    if (jarmu?.lat != null && jarmu?.lon != null) {
      map.panTo([jarmu.lat, jarmu.lon], { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dusitett, kivalasztott, kovetesEnabled]);
  return null;
}

function MapReadyHid({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    // A Leaflet a saját induláskori konténerméretét gyorsítótárazza — egy
    // 12 oszlopos grid/flex elrendezésben ez néha kisebbre adódik, mint a
    // végleges méret (a lista/részletek oszlopok tartalma csak ezután
    // renderelődik le teljesen), aminek eredménye egy pici, csak részben
    // kicsempézett térkép a doboz közepén. Egy explicit `invalidateSize()`
    // a réteg-elrendezés lezárulása (egy animation frame) után ezt javítja
    // — ez a hivatalosan javasolt megoldás react-leaflet flex/grid
    // konténerekben való használatához.
    requestAnimationFrame(() => map.invalidateSize());
  }, [map, onReady]);
  return null;
}

function TerkepVezerlok({
  isFullscreen,
  onFullscreenToggle,
  kovetesEnabled,
  onKovetesToggle,
  kivalasztottVan,
}) {
  const map = useMap();
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-soft-lg ring-1 ring-ink-100">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          aria-label="Nagyítás"
          className="flex h-9 w-9 items-center justify-center border-b border-ink-100 text-ink-600 transition-colors duration-150 hover:bg-slate-50"
        >
          <PiPlusLight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          aria-label="Kicsinyítés"
          className="flex h-9 w-9 items-center justify-center text-ink-600 transition-colors duration-150 hover:bg-slate-50"
        >
          <PiMinusLight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onFullscreenToggle}
        aria-label={isFullscreen ? "Kilépés a teljes képernyőből" : "Teljes képernyő"}
        title={isFullscreen ? "Kilépés a teljes képernyőből" : "Teljes képernyő"}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink-600 shadow-soft-lg ring-1 ring-ink-100 transition-colors duration-150 hover:bg-slate-50"
      >
        {isFullscreen ? (
          <PiArrowsInSimpleLight className="h-4 w-4" />
        ) : (
          <PiArrowsOutSimpleLight className="h-4 w-4" />
        )}
      </button>
      {kivalasztottVan && (
        <button
          type="button"
          onClick={onKovetesToggle}
          aria-pressed={kovetesEnabled}
          title="Kiválasztott jármű követése"
          className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-soft-lg ring-1 ring-ink-100 transition-colors duration-150 ${
            kovetesEnabled
              ? "bg-brand-600 text-white"
              : "bg-white text-ink-600 hover:bg-slate-50"
          }`}
        >
          <PiCrosshairSimpleLight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

const MAGYARORSZAG_KOZEPPONT = [47.1625, 19.5033];

export default function FlottaTerkep({
  dusitett,
  kivalasztott,
  onSelect,
  kovetesEnabled,
  onKovetesToggle,
}) {
  const wrapperRef = useRef(null);
  const mapRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Az automatikus behatárolás csak az ELSŐ betöltéskor fusson le — utána
  // a felhasználó saját pásztázása/zoomolása nem ugorhat vissza minden
  // percenkénti frissítésnél, az zavaró lenne.
  const [illesztesAktiv, setIllesztesAktiv] = useState(true);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const handler = () => {
      const fullscreenElem = document.fullscreenElement;
      setIsFullscreen(!!fullscreenElem && fullscreenElem === wrapperRef.current);
      // Fullscreen be-/kilépéskor a konténer mérete változik, a Leaflet
      // viszont csak a saját maga által észlelt méretváltozásra frissül —
      // enélkül a térkép csempéi a régi méretnél vágódnának le.
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // A térkép egy 12 oszlopos flex/grid elrendezés közepén él, aminek a
  // végleges mérete csak a lista/részletek oszlopok saját tartalmának
  // renderelése UTÁN áll be — a Leaflet viszont a saját induláskori
  // konténerméretét gyorsítótárazza, és enélkül a `ResizeObserver` nélkül
  // egy sokkal kisebb, elavult méretnél vágná le magát a csempéket (üres/
  // hiányos térkép, amíg a felhasználó kézzel át nem méretezi az ablakot).
  useEffect(() => {
    if (!wrapperRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen();
    }
  };

  useEffect(() => {
    if (kivalasztott) setIllesztesAktiv(false);
  }, [kivalasztott]);

  const ervenyesPoziciok = dusitett.filter((p) => p.lat != null && p.lon != null);

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full w-full overflow-hidden ${isFullscreen ? "bg-white" : ""}`}
    >
      <MapContainer
        center={MAGYARORSZAG_KOZEPPONT}
        zoom={7}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapReadyHid onReady={handleMapReady} />
        <TerkepIllesztes dusitett={dusitett} aktiv={illesztesAktiv} />
        <KovetesIllesztes
          dusitett={dusitett}
          kivalasztott={kivalasztott}
          kovetesEnabled={kovetesEnabled}
        />
        <TerkepVezerlok
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
          kovetesEnabled={kovetesEnabled}
          onKovetesToggle={onKovetesToggle}
          kivalasztottVan={!!kivalasztott}
        />
        {ervenyesPoziciok.map((p) => (
          <Marker
            key={p.rendszam}
            position={[p.lat, p.lon]}
            icon={jarmuIkon({
              irany: p.irany,
              tone: p._allapot.tone,
              kivalasztott: kivalasztott === p.rendszam,
            })}
            eventHandlers={{ click: () => onSelect(p.rendszam) }}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={1}>
              <span className="font-semibold">{p.rendszam}</span>
              {" · "}
              {p.sebesseg}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {ervenyesPoziciok.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-xl bg-white/90 px-4 py-2 text-sm text-ink-400 shadow-soft">
            Nincs megjeleníthető pozíció.
          </p>
        </div>
      )}
    </div>
  );
}
