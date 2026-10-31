import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Download, AlertCircle } from "lucide-react";

export const ReportsPage = () => {
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [ovRes, revRes] = await Promise.all([
          client.get("/reports/overview"),
          client.get("/reports/revenue"),
        ]);
        setOverview(ovRes.data);
        setRevenue(revRes.data?.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Financial Reports & Audit Ledger</h2>
        <p className="text-sm text-slate-500">Full audit breakdown of revenues, subscriptions, and aging</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-base text-slate-900 mb-4">Summary Ledger</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-semibold">Total Revenue</span>
            <p className="text-xl font-bold text-emerald-600">₹{parseFloat(overview?.revenue_collected || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-semibold">Total Outstanding</span>
            <p className="text-xl font-bold text-indigo-600">₹{parseFloat(overview?.outstanding || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-semibold">Total Overdue</span>
            <p className="text-xl font-bold text-red-600">₹{parseFloat(overview?.overdue_balance || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-semibold">Normalized MRR</span>
            <p className="text-xl font-bold text-slate-900">₹{parseFloat(overview?.mrr || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
