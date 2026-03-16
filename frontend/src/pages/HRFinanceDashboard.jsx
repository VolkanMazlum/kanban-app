import { useState, useEffect } from "react";
import ProjectFinances from "../components/ProjectFinances.jsx";
import FatturatoDashboard from "./FatturatoDashboard.jsx";
import ClientsManager from "../components/ClientsManager.jsx";
import UserManager from "../components/UserManager.jsx";
import { useLocation, useNavigate } from "react-router-dom";

export default function HRFinanceDashboard({ isHR, onRefresh }) {
  const [activeTab, setActiveTab] = useState("finances");

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized access. HR privileges required.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 65px)", background: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "12px 32px", display: "flex", gap: 12 }}>
        <button
          onClick={() => setActiveTab("finances")}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: activeTab === "finances" ? "#EEF2FF" : "transparent",
            color: activeTab === "finances" ? "#4F46E5" : "#6B7280",
            transition: "all 0.15s"
          }}
        >
          📈 Project Finances & Overhead
        </button>
        <button
          onClick={() => setActiveTab("fatturato")}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: activeTab === "fatturato" ? "#ECFCCB" : "transparent",
            color: activeTab === "fatturato" ? "#4D7C0F" : "#6B7280",
            transition: "all 0.15s"
          }}
        >
          💶 Fatturato Register
        </button>
        <button
          onClick={() => setActiveTab("clients")}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: activeTab === "clients" ? "#F3F4F6" : "transparent",
            color: activeTab === "clients" ? "#111827" : "#6B7280",
            transition: "all 0.15s"
          }}
        >
          👥 Clients Directory
        </button>
        <button
          onClick={() => setActiveTab("users")}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: activeTab === "users" ? "#FEF3C7" : "transparent",
            color: activeTab === "users" ? "#92400E" : "#6B7280",
            transition: "all 0.15s"
          }}
        >
          🔐 Users & Audit
        </button>
      </div>

      {/* Render Active View */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "finances" && <ProjectFinances isHR={isHR} />}
        {activeTab === "fatturato" && <FatturatoDashboard isHR={isHR} />}
        {activeTab === "clients" && <ClientsManager isHR={isHR} />}
        {activeTab === "users" && <UserManager isHR={isHR} onUserAdded={onRefresh} />}
      </div>
    </div>
  );
}
