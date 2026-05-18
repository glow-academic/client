"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL = 60_000; // 60 seconds

export function VersionBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const buildVersion = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION || "unknown";

  useEffect(() => {
    if (buildVersion === "dev") return;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = await res.json();
        if (version && version !== buildVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // silently ignore fetch errors
      }
    };

    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [buildVersion]);

  return (
    <>
      {/* API version badge — always visible */}
      <div
        style={{
          position: "fixed",
          bottom: "0.5rem",
          left: "0.5rem",
          zIndex: 9998,
          color: "#666",
          fontSize: "0.7rem",
          fontFamily: "monospace",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        Client {buildVersion} / API {apiVersion}
      </div>

      {/* Update available banner */}
      {updateAvailable && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: 9999,
            background: "#1a1a2e",
            color: "#e0e0e0",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.875rem",
            maxWidth: "360px",
          }}
        >
          <span>A new version is available.</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#4f46e5",
              color: "white",
              border: "none",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              whiteSpace: "nowrap",
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            style={{
              background: "transparent",
              color: "#999",
              border: "none",
              cursor: "pointer",
              fontSize: "1.125rem",
              lineHeight: 1,
              padding: "0 0.25rem",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
