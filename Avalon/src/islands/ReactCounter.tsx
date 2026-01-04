/** @jsxImportSource react */
"use client";

import { useState } from "react";

export default function ReactCounter({ initialCount = 0 }: { initialCount?: number }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "20px",
        background: "linear-gradient(135deg, #61dafb, #21a1c4)",
        color: "white",
        borderRadius: "10px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h4 style={{ margin: "0 0 15px 0" }}>⚛️ React Counter</h4>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "15px",
          background: "rgba(255, 255, 255, 0.2)",
          padding: "10px",
          borderRadius: "8px",
        }}
      >
        {count}
      </div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "10px" }}>
        <button
          onClick={() => setCount(count - 1)}
          style={{
            padding: "8px 16px",
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            fontSize: "1.2rem",
          }}
        >
          −
        </button>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            padding: "8px 16px",
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            fontSize: "1.2rem",
          }}
        >
          +
        </button>
      </div>
      <button
        onClick={() => setCount(0)}
        style={{
          padding: "6px 12px",
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          borderRadius: "6px",
          color: "white",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Reset
      </button>
      <p style={{ marginTop: "10px", fontSize: "0.9rem", opacity: 0.8 }}>Powered by React hooks</p>
    </div>
  );
}
