import React, { useState, useEffect, useRef } from "react";
import { fetchAction } from "utils/fetchAction";
import {
  PiPaperclipLight,
  PiCameraLight,
  PiImageLight,
  PiTrashLight,
  PiPaperPlaneRightFill,
  PiChatCircleTextLight,
  PiWarningCircleLight,
} from "react-icons/pi";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const formatTime = (timestamp) =>
  timestamp
    ? new Date(timestamp).toLocaleString("hu-HU", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function CardBejelentesek({ initBejelentesek }) {
  const [bejelentes] = useState(initBejelentesek || {});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Kamera eléréséhez
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (Object.keys(bejelentes).length > 0) {
      // Betöltjük a korábbi üzeneteket
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bejelentes]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const result = await fetchAction("getMessages", {
        bejelentesId: bejelentes.id,
      });
      if (result.success) {
        setMessages(result.messages);
      }
    } catch (error) {
      console.error("Hiba az üzenetek betöltésekor:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;

    try {
      const formData = new FormData();
      formData.append("bejelentesId", bejelentes.id);
      formData.append("message", newMessage);

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const result = await fetchAction("sendMessage", formData, true);

      if (result.success) {
        setNewMessage("");
        setAttachments([]);
        setPreviewImages([]);
        loadMessages();
      }
    } catch (error) {
      console.error("Hiba az üzenet küldésekor:", error);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);

    // Előnézet generálása
    const newPreviews = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target.result);
        if (newPreviews.length === files.length) {
          setPreviewImages([...previewImages, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    const newAttachments = [...attachments];
    const newPreviews = [...previewImages];

    newAttachments.splice(index, 1);
    newPreviews.splice(index, 1);

    setAttachments(newAttachments);
    setPreviewImages(newPreviews);
  };

  // Kamera kezelése
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Hiba a kamera elindításakor:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      context.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      canvasRef.current.toBlob(
        (blob) => {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          setAttachments([...attachments, file]);

          const reader = new FileReader();
          reader.onload = (e) => {
            setPreviewImages([...previewImages, e.target.result]);
          };
          reader.readAsDataURL(file);
        },
        "image/jpeg",
        0.95
      );

      stopCamera();
    }
  };

  if (Object.keys(bejelentes).length === 0) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-400 shadow-soft">
        Nincs kiválasztott bejelentés
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      {/* Bal oldali rész - Bejelentés adatai */}
      <div className="w-full flex-shrink-0 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft md:w-2/5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PiWarningCircleLight className="h-[18px] w-[18px]" />
          </span>
          <h2 className="font-display text-lg font-semibold text-brand-900">
            Bejelentés részletei
          </h2>
        </div>

        <dl className="space-y-3.5 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Bejelentő
            </dt>
            <dd className="mt-0.5 text-ink-700">{bejelentes.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Bejelentve
            </dt>
            <dd className="mt-0.5 text-ink-700">
              {new Date(bejelentes.bejelentve).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Típus
            </dt>
            <dd className="mt-0.5 text-ink-700">{bejelentes.tipus}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Leírás
            </dt>
            <dd className="mt-0.5 text-ink-700">
              {bejelentes.leiras || "Nincs leírás"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-ink-100 pt-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Képek csatolása
          </h3>

          {cameraActive ? (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-xl border border-ink-100">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                />
                <button
                  onClick={takePhoto}
                  className="absolute bottom-3 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-white text-red-600 shadow-soft-lg transition-transform duration-200 active:scale-95"
                >
                  <PiCameraLight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={stopCamera}
                className="mt-2 rounded-xl bg-sand-100 px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors duration-200 hover:bg-sand-200"
              >
                Mégse
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-100"
              >
                <PiImageLight className="h-4 w-4" /> Kép kiválasztása
              </button>

              <button
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-xl bg-sand-100 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors duration-200 hover:bg-sand-200"
              >
                <PiCameraLight className="h-4 w-4" /> Fotó készítése
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
            </div>
          )}

          {/* Képek előnézete */}
          {previewImages.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {previewImages.map((img, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-xl border border-ink-100"
                >
                  <img
                    src={img}
                    alt={`Csatolmány ${index + 1}`}
                    className="h-24 w-full object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/60 text-white transition-colors duration-200 hover:bg-red-600"
                  >
                    <PiTrashLight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Jobb oldali rész - Üzenetek (kérdés / válasz chat) */}
      <div className="flex w-full flex-col rounded-2xl border border-ink-100 bg-white shadow-soft md:w-3/5">
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-ink-100 px-5 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PiChatCircleTextLight className="h-[18px] w-[18px]" />
          </span>
          <h2 className="font-display text-lg font-semibold text-brand-900">
            Üzenetek
          </h2>
        </div>

        <div className="min-h-[260px] flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-ink-400">
              <PiChatCircleTextLight className="h-8 w-8 text-ink-200" />
              Nincsenek üzenetek
            </div>
          ) : (
            messages.map((msg, index) => {
              const isSystem = msg.system || msg.sender === "Rendszer";

              if (isSystem) {
                return (
                  <div key={index} className="flex justify-center">
                    <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-ink-500">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isAdmin = !!msg.isAdmin;
              return (
                <div
                  key={index}
                  className={`flex items-end gap-2 ${
                    isAdmin ? "flex-row-reverse" : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isAdmin
                        ? "bg-brand-600 text-white"
                        : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {initials(msg.sender)}
                  </span>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-soft ${
                      isAdmin
                        ? "rounded-br-sm bg-brand-600 text-white"
                        : "rounded-bl-sm bg-sand-100 text-ink-700"
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${
                        isAdmin ? "text-white/70" : "text-ink-400"
                      }`}
                    >
                      <span>{isAdmin ? "Válasz" : "Kérdés"}</span>
                      <span className="normal-case tracking-normal opacity-80">
                        {msg.sender}
                      </span>
                      <span
                        className={isAdmin ? "text-white/50" : "text-ink-300"}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.attachments?.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {msg.attachments.map((img, imgIndex) => (
                          <img
                            key={imgIndex}
                            src={img.url}
                            alt={`Csatolmány ${imgIndex + 1}`}
                            className="h-20 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 border-t border-ink-100 p-3">
          {previewImages.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <PiImageLight className="h-3.5 w-3.5" />
              {attachments.length} kép csatolva
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors duration-200 hover:bg-sand-100 hover:text-ink-700"
              title="Fájl csatolása"
            >
              <PiPaperclipLight className="h-[18px] w-[18px]" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Írj üzenetet..."
              className="flex-1 rounded-full border border-ink-100 bg-sand-50 px-4 py-2.5 text-sm text-brand-900 placeholder-ink-300 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && attachments.length === 0}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition-all duration-200 hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-ink-400 disabled:shadow-none"
              title="Küldés"
            >
              <PiPaperPlaneRightFill className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
