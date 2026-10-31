import React, { useState, useEffect } from "react";
import client from "../../api/client";

export const CustomerPortalPage = () => {
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, iRes] = await Promise.all([
        client.get("/portal/subscriptions").catch(() => ({ data: [] })),
        client.get("/portal/invoices").catch(() => ({ data: [] })),
      ]);
      // Handle both array and paginated responses
      const subsData = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.items || []);
      const invsData = Array.isArray(iRes.data) ? iRes.data : (iRes.data?.items || []);
      setSubs(subsData);
      setInvoices(invsData);
    } catch (err) {
      console.error("Portal fetch error:", err);
      setError(err.message || "Failed to load portal data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleSubAction = async (id, action) => {
    try {
      await client.post(`/portal/subscriptions/${id}/${action}`);
      fetchPortalData();
    } catch (err) {
      alert("Action failed: " + (err.message || "Unknown error"));
    }
  };

  const handleDownloadPdf = async (id, number) => {
    try {
      const res = await client.get(`/portal/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice_${number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Error: " + (err.message || "Failed to download PDF"));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
        Loading your portal data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#dc2626", fontSize: "14px" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>
          Welcome to Your Portal
        </h2>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          Manage your active plans, billing history, and invoices
        </p>
      </div>

      {/* Subscriptions */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>
          My Subscriptions ({subs.length})
        </h3>
        {subs.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#94a3b8" }}>No active subscriptions found.</p>
        ) : (
          <div>
            {subs.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "700", color: "#0f172a" }}>Subscription #{s.id}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        background: s.status === "active" ? "#ecfdf5" : "#fef3c7",
                        color: s.status === "active" ? "#047857" : "#b45309",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Period: {s.current_period_start || "-"} to {s.current_period_end || "-"} | Next Billing:{" "}
                    {s.next_billing_date || "-"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {s.status === "active" && (
                    <>
                      <button
                        onClick={() => handleSubAction(s.id, "pause")}
                        style={{ padding: "4px 12px", background: "#fef3c7", color: "#b45309", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => handleSubAction(s.id, "renew")}
                        style={{ padding: "4px 12px", background: "#e0e7ff", color: "#4338ca", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                      >
                        Renew
                      </button>
                      <button
                        onClick={() => handleSubAction(s.id, "close")}
                        style={{ padding: "4px 12px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {s.status === "paused" && (
                    <button
                      onClick={() => handleSubAction(s.id, "resume")}
                      style={{ padding: "4px 12px", background: "#ecfdf5", color: "#047857", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>
          My Invoices ({invoices.length})
        </h3>
        {invoices.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#94a3b8" }}>No invoices available.</p>
        ) : (
          <div>
            {invoices.map((inv) => (
              <div
                key={inv.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "14px",
                }}
              >
                <div>
                  <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f172a", marginRight: "8px" }}>
                    {inv.invoice_number || `INV-${inv.id}`}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Due {inv.due_date}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>
                    ₹{parseFloat(inv.total_amount || 0).toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      background: inv.status === "paid" ? "#ecfdf5" : "#eff6ff",
                      color: inv.status === "paid" ? "#047857" : "#1d4ed8",
                    }}
                  >
                    {inv.status}
                  </span>
                  <button
                    onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                    style={{ padding: "4px 10px", background: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "500", cursor: "pointer" }}
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalPage;
