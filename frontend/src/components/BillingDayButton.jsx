import React, { useState } from "react";
import client from "../api/client";
import { Zap } from "lucide-react";

export const BillingDayButton = ({ onCompleted }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleSimulate = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await client.post("/simulate/billing-day?limit=200");
      setResult(res.data);
      if (onCompleted) onCompleted(res.data);
    } catch (err) {
      alert("Simulation failed: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
      <button
        onClick={handleSimulate}
        disabled={running}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#4f46e5",
          color: "#ffffff",
          fontWeight: "600",
          fontSize: "14px",
          padding: "10px 18px",
          borderRadius: "8px",
          border: "none",
          cursor: running ? "not-allowed" : "pointer",
          opacity: running ? 0.6 : 1,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        <Zap style={{ width: "16px", height: "16px", fill: "#ffffff" }} />
        {running ? "Simulating Billing Day..." : "Simulate Billing Day"}
      </button>

      {result && (
        <div style={{ fontSize: "12px", fontWeight: "600" }}>
          {result.due_found === 0 ? (
            <span style={{ color: "#64748b" }}>
              Nothing due: everything already billed.
            </span>
          ) : (
            <span style={{ color: "#16a34a" }}>
              Generated {result.invoices_created} invoices ({result.due_found} due).
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BillingDayButton;
