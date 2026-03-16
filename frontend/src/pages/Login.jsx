import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login({ username, password });
      if (res.success && res.token) {
        localStorage.setItem("token", res.token);
        localStorage.setItem("role", res.role);
        localStorage.setItem("employeeId", res.employeeId || "");
        localStorage.setItem("isHR", res.role === "hr" ? "true" : "false");
        localStorage.setItem("userName", res.name || username);
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F9FAFB",
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: "#fff",
        padding: 40,
        borderRadius: 16,
        boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        width: 400
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: "#2563EB", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 24, margin: "0 auto 16px"
          }}>T</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>TEKSER</h2>
          <p style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, letterSpacing: "0.06em", marginTop: 4 }}>PROJECT MANAGEMENT</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 8,
                border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                fontFamily: "'Inter', sans-serif"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 8,
                border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                fontFamily: "'Inter', sans-serif"
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#FEF2F2", color: "#DC2626", padding: 12,
              borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 20,
              border: "1px solid #FECACA"
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%", padding: "14px", background: "#2563EB",
              color: "#fff", border: "none", borderRadius: 8, fontSize: 15,
              fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer",
              transition: "background 0.2s"
            }}
          >
            {isLoading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
