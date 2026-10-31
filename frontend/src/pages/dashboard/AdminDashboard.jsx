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
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [ovRes, odRes] = await Promise.all([
        client.get("/reports/overview"),
        client.get("/reports/overdue"),
      ]);
      setOverview(ovRes.data);
      setOverdueData(odRes.data?.items || []);
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

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
        <div className="shrink-0">
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
    </div>
  );
};

export default AdminDashboard;
