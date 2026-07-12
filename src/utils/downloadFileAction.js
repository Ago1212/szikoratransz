export const downloadFileAction = async (id, filename) => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  const modulename =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8001/api.php"
      : "https://szikora-transz.hu/backend/api.php";

  try {
    const response = await fetch(modulename, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHash}`,
      },
      body: JSON.stringify({
        authHash: authHash,
        sessionToken: sessionStorage.getItem("sessionToken") || "",
        action: "downloadFile",
        id,
      }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    const link = document.createElement("a");
    link.href = `data:${data.mime};base64,${data.file}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Hiba a letöltés során:", error);
  }
};
