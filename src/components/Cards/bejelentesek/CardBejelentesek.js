import React, { useState, useEffect, useRef } from "react";
import { fetchAction } from "utils/fetchAction";
import {
  FaPaperclip,
  FaCamera,
  FaImage,
  FaTrash,
  FaPaperPlane,
} from "react-icons/fa";

export default function CardBejelentesek({ initBejelentesek }) {
  const [bejelentes, setBejelentes] = useState(initBejelentesek || {});
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
    return <div className="p-4 text-center">Nincs kiválasztott bejelentés</div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4">
      {/* Bal oldali rész - Bejelentés adatai */}
      <div className="w-full md:w-1/2 bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Bejelentés részletei</h2>

        <div className="mb-4">
          <p className="font-semibold">Bejelentő:</p>
          <p>{bejelentes.name}</p>
        </div>

        <div className="mb-4">
          <p className="font-semibold">Bejelentve:</p>
          <p>{new Date(bejelentes.bejelentve).toLocaleString()}</p>
        </div>

        <div className="mb-4">
          <p className="font-semibold">Típus:</p>
          <p>{bejelentes.tipus}</p>
        </div>

        <div className="mb-4">
          <p className="font-semibold">Leírás:</p>
          <p>{bejelentes.leiras || "Nincs leírás"}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-2">Képek csatolása</h3>

          {cameraActive ? (
            <div className="mb-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded border"
                />
                <button
                  onClick={takePhoto}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-2 rounded-full"
                >
                  <FaCamera size={24} />
                </button>
              </div>
              <button
                onClick={stopCamera}
                className="mt-2 bg-gray-500 text-white px-3 py-1 rounded"
              >
                Mégse
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => fileInputRef.current.click()}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded"
              >
                <FaImage /> Kép kiválasztása
              </button>

              <button
                onClick={startCamera}
                className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded"
              >
                <FaCamera /> Fotó készítése
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
            <div className="grid grid-cols-3 gap-2 mt-4">
              {previewImages.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={img}
                    alt={`Csatolmány ${index + 1}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Jobb oldali rész - Üzenetek */}
      <div className="w-full md:w-1/2 bg-white rounded-lg shadow flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Üzenetek</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500">Nincsenek üzenetek</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-lg max-w-xs ${
                  msg.isAdmin ? "ml-auto bg-blue-100" : "mr-auto bg-gray-100"
                }`}
              >
                <p className="font-semibold">{msg.sender}</p>
                <p className="mb-2">{msg.text}</p>
                <p className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleString()}
                </p>

                {msg.attachments?.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {msg.attachments.map((img, imgIndex) => (
                      <img
                        key={imgIndex}
                        src={img.url}
                        alt={`Csatolmány ${imgIndex + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Írj üzenetet..."
              className="flex-1 border rounded px-3 py-2"
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && attachments.length === 0}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              <FaPaperPlane />
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              {attachments.length} kép csatolva
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
