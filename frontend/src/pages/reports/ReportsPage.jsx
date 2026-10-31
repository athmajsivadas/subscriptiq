import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Download, AlertCircle, FileSpreadsheet, TrendingUp, Clock, FileText } from "lucide-react";

export const ReportsPage = () => {
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [ovRes, revRes] = await Promise.all([
          client.get("/reports/overview"),
          client.get("/reports/revenue?page=1&page_size=10"),
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

  const downloadCsv = async (endpoint, defaultFilename, exportKey) => {
    setExporting(exportKey);
    try {
      const res = await client.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", defaultFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to export report CSV: " + (err.message || "Unknown error"));
    } finally {
      setExporting(null);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financial Reports & Audit Ledger</h2>
          <p className="text-sm text-slate-500">Full audit breakdown of revenues, subscriptions, and aging</p>
        </div>
      </div>

      {/* Summary Ledger Cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-base text-slate-900 mb-4">Executive Summary Ledger</h3>
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
            <p className="text-xl font-bold text-red-600">₹{parseFloat(overview?.overdue_amount || overview?.overdue_balance || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-semibold">Normalized MRR</span>
            <p className="text-xl font-bold text-slate-900">₹{parseFloat(overview?.mrr || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* One-Click CSV Export Center */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
          <h3 className="font-bold text-base text-slate-900">Export Financial Reports (CSV)</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Download formatted, spreadsheet-ready CSV ledgers for external accounting, auditing, and tax compliance.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue CSV */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>Revenue & Cash Journal</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                All historical payments with payment methods, dates, transaction notes, and invoice links.
              </p>
            </div>
            <button
              onClick={() => downloadCsv("/reports/export/revenue-csv", `revenue_report_${todayStr}.csv`, "revenue")}
              disabled={exporting === "revenue"}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "revenue" ? "Exporting..." : "Export Revenue CSV"}
            </button>
          </div>

          {/* Overdue CSV */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
                <Clock className="h-4 w-4 text-red-600" />
                <span>Overdue Aging Ledger</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Confirmed unpaid receivables segmented into 1–30, 31–60, and 60+ days overdue buckets.
              </p>
            </div>
            <button
              onClick={() => downloadCsv("/reports/export/overdue-csv", `overdue_aging_${todayStr}.csv`, "overdue")}
              disabled={exporting === "overdue"}
              className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "overdue" ? "Exporting..." : "Export Overdue Aging CSV"}
            </button>
          </div>

          {/* Subscriptions CSV */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Subscriptions Master</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Complete subscription list with billing cycles, next billing dates, and active lifecycle states.
              </p>
            </div>
            <button
              onClick={() => downloadCsv("/reports/export/subscriptions-csv", `subscriptions_ledger_${todayStr}.csv`, "subscriptions")}
              disabled={exporting === "subscriptions"}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "subscriptions" ? "Exporting..." : "Export Subscriptions CSV"}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Cash Flow Transactions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-base text-slate-900">Recent Revenue Entries</h3>
        </div>
        {revenue.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No payment records yet.</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Payment Ref</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {revenue.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-900">{r.payment_date}</td>
                  <td className="px-6 py-3 text-slate-500">{r.payment_reference || "—"}</td>
                  <td className="px-6 py-3 capitalize">{r.method}</td>
                  <td className="px-6 py-3 font-semibold text-emerald-600">₹{parseFloat(r.amount).toFixed(2)}</td>
                  <td className="px-6 py-3 text-slate-500">{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
