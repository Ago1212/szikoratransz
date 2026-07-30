import React from "react";
import { PiNotePencilLight } from "react-icons/pi";

// Kiemelt "jegyzet"-doboz (pl. fuvar megjegyzés) — sand hátterű, hogy
// vizuálisan elkülönüljön a sima szövegsoroktól. Nem renderelődik, ha
// nincs szöveg.
export default function NoteCard({ text }) {
  if (!text) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-sand-100 bg-sand-50 p-3">
      <PiNotePencilLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" />
      <p className="text-sm text-ink-700">{text}</p>
    </div>
  );
}
