import React, { useState, useEffect } from "react";
import client from "../../api/client";

export const PortalInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get("/portal/invoices");
        setInvoices(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handlePdf = async (id, number) => {
    try {
      const res = await client.get(`/portal/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `Invoice_${number || id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { alert("PDF error: " + (err.message || "Error")); }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading invoices...</div>;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>My Invoices ({invoices.length})</h2>
      {invoices.length === 0 ? <p style={{ color: "#94a3b8" }}>No invoices available.</p> : (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px" }}>
          {invoices.map((inv) => (
            <div key={inv.id} style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f172a" }}>{inv.invoice_number || `INV-${inv.id}`}</span>
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>Due {inv.due_date}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>₹{parseFloat(inv.total_amount || 0).toFixed(2)}</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", fontWeight: "600", textTransform: "uppercase", background: inv.status === "paid" ? "#ecfdf5" : "#eff6ff", color: inv.status === "paid" ? "#047857" : "#1d4ed8" }}>{inv.status}</span>
                <button onClick={() => handlePdf(inv.id, inv.invoice_number)} style={{ padding: "4px 10px", background: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "500", cursor: "pointer" }}>PDF</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalInvoicesPage;
