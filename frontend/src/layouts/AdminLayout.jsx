import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Package,
  Layers,
  Percent,
  Receipt,
  FileText,
  CreditCard,
  BarChart3,
  LogOut,
  User,
  Users,
  ShieldCheck,
  FileCheck2,
  ScrollText,
} from "lucide-react";

export const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tax Rules", href: "/catalog/tax-rules", icon: ShieldCheck },
    { label: "Products", href: "/catalog/products", icon: Package },
    { label: "Plans", href: "/catalog/plans", icon: Layers },
    { label: "Discounts", href: "/catalog/discounts", icon: Percent },
    { label: "Templates", href: "/catalog/templates", icon: FileCheck2 },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Quotations", href: "/quotations", icon: FileText },
    { label: "Subscriptions", href: "/subscriptions", icon: Receipt },
    { label: "Invoices", href: "/invoices", icon: Receipt },
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Audit Trail", href: "/audit-logs", icon: ScrollText },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            S
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">SubscriptIQ</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold uppercase tracking-wider">
              Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-slate-900 truncate">{user?.email}</p>
                <p className="text-[10px] text-slate-500 uppercase">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Workspace</span>
            <span>/</span>
            <span className="font-semibold text-slate-800 capitalize">
              {location.pathname.replace("/", "").replace(/-/g, " ") || "Dashboard"}
            </span>
          </div>
        </header>
        <div className="p-8 flex-1">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
