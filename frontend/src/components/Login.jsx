import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api.js";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleMode, setRoleMode] = useState("standard"); // 'standard' | 'hr'
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // If HR, username is implied to be 'hr'
      const payload = roleMode === "hr" ? { username: "hr", password } : { username, password };

      const res = await api.login(payload);
      if (res.success && res.token) {
        // Store JWT token securely
        localStorage.setItem("token", res.token);
        // Store role to conditional render HR tabs
        localStorage.setItem("role", res.role);
        localStorage.setItem("isHR", res.role === "hr" ? "true" : "false");

        // Redirect to main board
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

        {/* Role Toggle */}
        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 4, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => { setRoleMode("standard"); setError(null); }}
            style={{
              flex: 1, padding: "8px 16px", border: "none", borderRadius: 6,
              background: roleMode === "standard" ? "#fff" : "transparent",
              color: roleMode === "standard" ? "#111827" : "#6B7280",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              boxShadow: roleMode === "standard" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >Standard</button>
          <button
            type="button"
            onClick={() => { setRoleMode("hr"); setError(null); }}
            style={{
              flex: 1, padding: "8px 16px", border: "none", borderRadius: 6,
              background: roleMode === "hr" ? "#fff" : "transparent",
              color: roleMode === "hr" ? "#111827" : "#6B7280",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              boxShadow: roleMode === "hr" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >Admin</button>
        </div>

        <form onSubmit={handleLogin}>
          {roleMode === "standard" && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required={roleMode === "standard"}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 8,
                  border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                  fontFamily: "'Inter', sans-serif"
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              {roleMode === "hr" ? "MASTER PASSWORD" : "PASSWORD"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
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
