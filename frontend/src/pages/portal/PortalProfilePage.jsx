import React, { useState, useEffect } from "react";
import client from "../../api/client";

export const PortalProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get("/portal/profile");
        setProfile(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading profile...</div>;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>My Profile</h2>
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", maxWidth: "480px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>Full Name</label>
          <p style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a", margin: "4px 0 0 0" }}>{profile?.full_name || "-"}</p>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>Email</label>
          <p style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a", margin: "4px 0 0 0" }}>{profile?.email || "-"}</p>
        </div>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>Role</label>
          <p style={{ fontSize: "16px", fontWeight: "600", color: "#1d4ed8", margin: "4px 0 0 0", textTransform: "capitalize" }}>{profile?.role || "-"}</p>
        </div>
      </div>
    </div>
  );
};

export default PortalProfilePage;
