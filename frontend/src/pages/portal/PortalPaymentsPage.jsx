import React, { useState, useEffect } from "react";
import client from "../../api/client";

export const PortalPaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get("/portal/payments");
        setPayments(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading payments...</div>;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>Payment History ({payments.length})</h2>
      {payments.length === 0 ? <p style={{ color: "#94a3b8" }}>No payments recorded.</p> : (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px" }}>
          {payments.map((p) => (
            <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f172a" }}>PAY-{p.id}</span>
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>Invoice #{p.invoice_id}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontWeight: "700", color: "#047857" }}>₹{parseFloat(p.amount || 0).toFixed(2)}</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", fontWeight: "500", textTransform: "uppercase" }}>{p.payment_method}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalPaymentsPage;
