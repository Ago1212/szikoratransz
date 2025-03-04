export const downloadFileAction = async (id, filename) => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  const modulename = "http://localhost:8000/api.php";

  try {
    const response = await fetch(modulename, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHash}`,
      },
      body: JSON.stringify({
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
