export const fetchAction = async (action, payload) => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  //const modulename = "https://szikora-transz.hu/backend/api.php"; //http://localhost:8000/api.php
  const modulename =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8000/api.php"
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
        action,
        ...payload,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error fetching data:", error);
    return { success: false, message: error.message };
  }
};
