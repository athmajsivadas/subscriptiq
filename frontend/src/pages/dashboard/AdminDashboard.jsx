import React, { useState, useEffect } from "react";
import client from "../../api/client";
import BillingDayButton from "../../components/BillingDayButton";
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  Users,
  Calendar,
  CheckCircle2,
  UserPlus,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [overdueData, setOverdueData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffError, setStaffError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [ovRes, odRes, staffRes] = await Promise.all([
        client.get("/reports/overview").catch(() => ({ data: null })),
        client.get("/reports/overdue").catch(() => ({ data: { items: [] } })),
        client.get("/auth/users/staff").catch(() => ({ data: [] })),
      ]);
      setOverview(ovRes.data);
      setOverdueData(odRes.data?.items || []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffError(null);
    setStaffSubmitting(true);
    try {
      await client.post("/auth/users/staff", {
        full_name: staffName.trim(),
        email: staffEmail.trim(),
        password: staffPassword,
      });
      setIsStaffModalOpen(false);
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      fetchDashboard();
      alert("Staff user created successfully!");
    } catch (err) {
      setStaffError(err.message || "Failed to create staff member");
    } finally {
      setStaffSubmitting(false);
    }
  };

  const chartData = [
    { name: "MRR", amount: parseFloat(overview?.mrr || 0) },
    { name: "Revenue", amount: parseFloat(overview?.revenue_collected || 0) },
    { name: "Outstanding", amount: parseFloat(overview?.outstanding || 0) },
    { name: "Overdue", amount: parseFloat(overview?.overdue_balance || 0) },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Billing Day trigger */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Executive Financial Overview</h2>
          <p className="text-sm text-slate-500">Real-time MRR, recurring billings, and cash flow</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsStaffModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add Staff User
          </button>
          <BillingDayButton onCompleted={fetchDashboard} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Monthly Recurring (MRR)</p>
            <h3 className="text-2xl font-bold text-slate-900">₹{parseFloat(overview?.mrr || 0).toLocaleString("en-IN")}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Revenue Collected</p>
            <h3 className="text-2xl font-bold text-emerald-600">₹{parseFloat(overview?.revenue_collected || 0).toLocaleString("en-IN")}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Active Subscriptions</p>
            <h3 className="text-2xl font-bold text-slate-900">{overview?.active_subscriptions || 0}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Overdue Invoices</p>
            <h3 className="text-2xl font-bold text-red-600">
              {overview?.overdue_invoices_count || 0} (₹{parseFloat(overview?.overdue_balance || 0).toLocaleString("en-IN")})
            </h3>
          </div>
        </div>
      </div>

      {/* Chart & Aging Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[340px]">
          <h3 className="font-bold text-base text-slate-900 mb-4">Financial Metrics (₹)</h3>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 mb-4">Overdue Aging Buckets</h3>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-xs font-bold text-amber-800 uppercase">1 - 30 Days</span>
              <p className="text-lg font-bold text-amber-900">
                ₹{parseFloat(overview?.overdue_buckets?.["1-30"] || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
              <span className="text-xs font-bold text-orange-800 uppercase">31 - 60 Days</span>
              <p className="text-lg font-bold text-orange-900">
                ₹{parseFloat(overview?.overdue_buckets?.["31-60"] || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <span className="text-xs font-bold text-red-800 uppercase">60+ Days</span>
              <p className="text-lg font-bold text-red-900">
                ₹{parseFloat(overview?.overdue_buckets?.["60+"] || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Management Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Operations Staff ({staffList.length})</h3>
            <p className="text-xs text-slate-500">Authorized staff members handling day-to-day operations</p>
          </div>
          <button
            onClick={() => setIsStaffModalOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add New Staff
          </button>
        </div>

        {staffList.length === 0 ? (
          <p className="text-xs text-slate-400">No staff users registered yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {staffList.map((st) => (
              <div key={st.id} className="p-3 border border-slate-100 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{st.full_name}</p>
                  <p className="text-xs text-slate-500">{st.email}</p>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Staff
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Staff */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Staff User</h3>
            {staffError && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="staff2@brightloop.test"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="StaffPassword#2026"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be &gt;8 chars and contain uppercase, lowercase, and special characters.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {staffSubmitting ? "Creating..." : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
