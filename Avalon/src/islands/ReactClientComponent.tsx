/** @jsxImportSource react */
"use client";

import { useState } from "react";

interface ReactClientComponentProps {
  title?: string;
  message?: string;
}

export default function ReactClientComponent({ 
  title = "React Client Component",
  message = "This component requires client-side JavaScript for interactivity.",
}: ReactClientComponentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likes, setLikes] = useState(0);

  return (
    <div style={{
      padding: "20px",
      border: "2px solid #61dafb",
      borderRadius: "8px",
      backgroundColor: "#282c34",
      color: "white",
      fontFamily: "system-ui, sans-serif",
    }}>
      <h2 style={{ margin: "0 0 8px 0" }}>{title}</h2>
      <p style={{ 
        fontSize: "12px", 
        color: "#61dafb", 
        margin: "0 0 16px 0",
        fontWeight: "bold",
      }}>
        ⚡ Client Component (with "use client" directive)
      </p>
      <p style={{ marginBottom: "16px" }}>{message}</p>
      
      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: "4px",
            color: "#282c34",
            fontWeight: "bold",
            width: "100%",
          }}
        >
          {isExpanded ? "Hide Details ▲" : "Show Details ▼"}
        </button>
      </div>

      {isExpanded && (
        <div style={{
          padding: "12px",
          backgroundColor: "rgba(97, 218, 251, 0.1)",
          borderRadius: "4px",
          marginBottom: "16px",
        }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            This component demonstrates:
          </p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px" }}>
            <li>useState hook for local state</li>
            <li>Event handlers (onClick)</li>
            <li>Conditional rendering</li>
            <li>Client-side interactivity</li>
          </ul>
        </div>
      )}

      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px",
        padding: "12px",
        backgroundColor: "rgba(97, 218, 251, 0.1)",
        borderRadius: "4px",
      }}>
        <button
          onClick={() => setLikes(likes + 1)}
          style={{
            padding: "8px 16px",
            fontSize: "20px",
            cursor: "pointer",
            backgroundColor: "#ff6b6b",
            border: "none",
            borderRadius: "4px",
            color: "white",
          }}
        >
          ❤️
        </button>
        <span style={{ fontSize: "18px", fontWeight: "bold" }}>
          {likes} {likes === 1 ? "like" : "likes"}
        </span>
      </div>
    </div>
  );
}
