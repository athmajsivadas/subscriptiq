import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const CustomerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", href: "/portal" },
    { label: "Available Plans", href: "/portal/plans" },
    { label: "My Subscriptions", href: "/portal/subscriptions" },
    { label: "My Invoices", href: "/portal/invoices" },
    { label: "Payments", href: "/portal/payments" },
    { label: "My Profile", href: "/portal/profile" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#f8fafc", color: "#0f172a" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "256px",
          borderRight: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              height: "36px",
              width: "36px",
              borderRadius: "8px",
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: "700",
              fontSize: "18px",
            }}
          >
            S
          </div>
          <div>
            <h1 style={{ fontWeight: "700", color: "#0f172a", margin: 0, lineHeight: "1.2", fontSize: "16px" }}>
              SubscriptIQ
            </h1>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "9999px",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Customer Portal
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  display: "block",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  textDecoration: "none",
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "16px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <div
                style={{
                  height: "32px",
                  width: "32px",
                  borderRadius: "50%",
                  background: "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1d4ed8",
                  fontWeight: "600",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontSize: "12px", fontWeight: "500", color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.email}
                </p>
                <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", margin: 0 }}>
                  {user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Logout"
              style={{
                padding: "6px",
                color: "#94a3b8",
                border: "none",
                background: "transparent",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: "64px",
            borderBottom: "1px solid #e2e8f0",
            background: "#fff",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#64748b" }}>
            <span>Customer Portal</span>
            <span>/</span>
            <span style={{ fontWeight: "600", color: "#1e293b", textTransform: "capitalize" }}>
              {location.pathname.replace("/portal", "").replace("/", "") || "Dashboard"}
            </span>
          </div>
        </header>
        <div style={{ padding: "32px", flex: 1 }}>{children}</div>
      </main>
    </div>
  );
};

export default CustomerLayout;
