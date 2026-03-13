import { useState } from "react";

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(17, 24, 39, 0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: 28,
        width: 400,
        maxWidth: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        fontFamily: "'Inter',sans-serif"
      }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{
            color: "#111827",
            margin: 0,
            fontSize: 18,
            fontWeight: 700
          }}>
            {title}
          </h3>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <p style={{
            color: "#374151",
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0
          }}>
            {message}
          </p>
        </div>
        
        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: 11,
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "'Inter',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {confirmText}
          </button>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: 11,
              background: "#F9FAFB",
              color: "#374151",
              border: "1.5px solid #E5E7EB",
              borderRadius: 8,
              fontFamily: "'Inter',sans-serif",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}