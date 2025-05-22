import { React, useState } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";

export default function Bejelentkezes() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Kérjük töltsd ki mindkét mezőt!");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await fetchAction("loginUser", {
        email: email,
        password: password,
      });
      if (result && result.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));
        history.push("/admin/dashboard");
      } else {
        setError(result.message || "Hibás email vagy jelszó!");
      }
    } catch (err) {
      setError("Hiba történt a bejelentkezés során!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const navigateToHome = () => {
    history.push("/");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          padding: "32px",
          position: "relative",
        }}
      >
        {/* Vissza gomb */}
        <button
          onClick={navigateToHome}
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Vissza</span>
        </button>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#1e293b",
              marginBottom: "8px",
            }}
          >
            Bejelentkezés
          </h1>
          <p style={{ color: "#64748b" }}>Kérjük add meg belépési adataidat</p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "500",
                color: "#334155",
                marginBottom: "4px",
              }}
            >
              Email cím
            </label>
            <input
              type="email"
              id="email"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                transition: "all 0.2s",
              }}
              placeholder="email@pelda.hu"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "500",
                color: "#334155",
                marginBottom: "4px",
              }}
            >
              Jelszó
            </label>
            <input
              type="password"
              id="password"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                transition: "all 0.2s",
              }}
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "8px",
              backgroundColor: isLoading ? "#93c5fd" : "#2563eb",
              color: "white",
              fontWeight: "500",
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                Bejelentkezés...
              </>
            ) : (
              "Bejelentkezés"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
