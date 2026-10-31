import React, { useState, useEffect } from "react";
import client from "../../api/client";

export const PortalSubscriptionsPage = () => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const res = await client.get("/portal/subscriptions");
      setSubs(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubs(); }, []);

  const handleAction = async (id, action) => {
    try { await client.post(`/portal/subscriptions/${id}/${action}`); fetchSubs(); }
    catch (err) { alert("Action failed: " + (err.message || "Error")); }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading subscriptions...</div>;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>My Subscriptions ({subs.length})</h2>
      {subs.length === 0 ? <p style={{ color: "#94a3b8" }}>No subscriptions found.</p> : (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px" }}>
          {subs.map((s) => (
            <div key={s.id} style={{ padding: "14px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>Subscription #{s.id}</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", fontWeight: "600", textTransform: "uppercase", background: s.status === "active" ? "#ecfdf5" : "#fef3c7", color: s.status === "active" ? "#047857" : "#b45309", marginLeft: "8px" }}>{s.status}</span>
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Period: {s.current_period_start || "-"} to {s.current_period_end || "-"} | Next Billing: {s.next_billing_date || "-"}</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {s.status === "active" && (
                  <>
                    <button onClick={() => handleAction(s.id, "pause")} style={{ padding: "4px 12px", background: "#fef3c7", color: "#b45309", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Pause</button>
                    <button onClick={() => handleAction(s.id, "renew")} style={{ padding: "4px 12px", background: "#e0e7ff", color: "#4338ca", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Renew</button>
                    <button onClick={() => handleAction(s.id, "close")} style={{ padding: "4px 12px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                  </>
                )}
                {s.status === "paused" && (
                  <button onClick={() => handleAction(s.id, "resume")} style={{ padding: "4px 12px", background: "#ecfdf5", color: "#047857", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Resume</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalSubscriptionsPage;
