// A megosztott `fetchAction` a `fetch()` API-t használja, ami NEM ad valós
// feltöltési előrehaladást (csak `XMLHttpRequest.upload.onprogress` ad) —
// ez a segédfüggvény ugyanazt a kérés-alakot (authHash/sessionToken/action
// + payload) építi fel, de XHR-en keresztül, hogy a feltöltési sor valódi,
// nem kitalált százalékot mutathasson.
export const uploadFajlXhr = (payload, onProgress, action = "fileUpload") => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  const modulename =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8001/api.php"
      : "https://szikora-transz.hu/backend/api.php";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", modulename);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${authHash}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch (error) {
        reject(new Error("Érvénytelen szerver-válasz."));
      }
    };
    xhr.onerror = () => reject(new Error("Hálózati hiba a feltöltés során."));
    xhr.send(
      JSON.stringify({
        authHash,
        sessionToken: localStorage.getItem("sessionToken") || "",
        action,
        ...payload,
      }),
    );
  });
};
