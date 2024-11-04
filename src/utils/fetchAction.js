export const fetchAction = async (action, payload) => {
    const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
    const modulename = "http://localhost:8000/api.php";
    
    try {
      const response = await fetch(modulename, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHash}`, 
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      });
  
      const jsonResponse = await response.json();
      return jsonResponse;
  
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  