/** @jsxImportSource react */
"use client";

import { useState, useEffect } from "react";

interface FormData {
  name: string;
  email: string;
  message: string;
}

export default function ReactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // useEffect to track character count
  useEffect(() => {
    setCharCount(formData.message.length);
  }, [formData.message]);

  // useEffect to log form interactions (demo purposes)
  useEffect(() => {
    console.log("React Form mounted");
    return () => {
      console.log("React Form unmounted");
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", message: "" });
    }, 3000);
  };

  const isValid = formData.name && formData.email && formData.message;

  return (
    <div style={{
      padding: "20px",
      border: "2px solid #61dafb",
      borderRadius: "8px",
      backgroundColor: "#282c34",
      color: "white",
      fontFamily: "system-ui, sans-serif",
      maxWidth: "500px",
    }}>
      <h2 style={{ margin: "0 0 8px 0" }}>React Form</h2>
      <p style={{ 
        fontSize: "12px", 
        color: "#61dafb", 
        margin: "0 0 16px 0",
      }}>
        Demonstrates useEffect and event handling
      </p>

      {submitted ? (
        <div style={{
          padding: "20px",
          backgroundColor: "#4caf50",
          borderRadius: "4px",
          textAlign: "center",
        }}>
          <h3 style={{ margin: "0 0 8px 0" }}>✓ Success!</h3>
          <p style={{ margin: 0 }}>Form submitted successfully</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Name:
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                borderRadius: "4px",
                border: "1px solid #61dafb",
                backgroundColor: "#1a1d23",
                color: "white",
                boxSizing: "border-box",
              }}
              placeholder="Enter your name"
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Email:
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                borderRadius: "4px",
                border: "1px solid #61dafb",
                backgroundColor: "#1a1d23",
                color: "white",
                boxSizing: "border-box",
              }}
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Message:
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                borderRadius: "4px",
                border: "1px solid #61dafb",
                backgroundColor: "#1a1d23",
                color: "white",
                boxSizing: "border-box",
                resize: "vertical",
              }}
              placeholder="Enter your message"
            />
            <div style={{ 
              fontSize: "12px", 
              color: charCount > 100 ? "#4caf50" : "#999",
              marginTop: "4px",
            }}>
              {charCount} characters
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              cursor: isValid ? "pointer" : "not-allowed",
              backgroundColor: isValid ? "#61dafb" : "#555",
              border: "none",
              borderRadius: "4px",
              color: isValid ? "#282c34" : "#999",
              fontWeight: "bold",
              opacity: isValid ? 1 : 0.5,
            }}
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
}
