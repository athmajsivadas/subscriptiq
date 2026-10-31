import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Users, FileText, CheckCircle, Clock } from "lucide-react";

export const StaffOpsPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaffData = async () => {
      setLoading(true);
      try {
        const res = await client.get("/reports/staff-overview");
        setOverview(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaffData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Staff Operations Dashboard</h2>
        <p className="text-sm text-slate-500">Operational counts and queue metrics (non-financial access)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Active Subscriptions</p>
            <h3 className="text-2xl font-bold text-slate-900">{overview?.active_subscriptions || 0}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Draft Invoices</p>
            <h3 className="text-2xl font-bold text-amber-700">{overview?.draft_invoices_count || 0}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Overdue Invoices</p>
            <h3 className="text-2xl font-bold text-red-600">{overview?.overdue_invoices_count || 0}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffOpsPage;
