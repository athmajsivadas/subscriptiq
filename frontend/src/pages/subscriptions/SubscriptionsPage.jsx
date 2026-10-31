import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { AlertCircle, Play, Pause, XCircle, RotateCcw } from "lucide-react";

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/subscriptions?page=${page}&page_size=15`);
      setSubscriptions(res.data?.items || []);
      setTotalPages(Math.ceil((res.data?.total || 1) / 15));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [page]);

  const handleTransition = async (subId, action) => {
    try {
      await client.post(`/subscriptions/${subId}/${action}`);
      fetchSubscriptions();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Subscriptions Lifecycle</h2>
        <p className="text-sm text-slate-500">Manage subscriptions, transitions, cycles, and view status timelines</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading subscriptions...</div>
      ) : subscriptions.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No subscriptions found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Sub #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Billing Cycle</th>
                <th className="px-6 py-3">Next Billing</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">SUB-{s.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">Cust #{s.customer_id}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">Plan #{s.plan_id}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {s.current_period_start || "-"} to {s.current_period_end || "-"}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-700">
                    {s.next_billing_date || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : s.status === "draft"
                          ? "bg-slate-100 text-slate-600"
                          : s.status === "paused"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1.5">
                    {s.status === "draft" && (
                      <button
                        onClick={() => handleTransition(s.id, "activate")}
                        className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded inline-flex items-center gap-1"
                      >
                        <Play className="h-3 w-3" /> Activate
                      </button>
                    )}
                    {s.status === "active" && (
                      <>
                        <button
                          onClick={() => handleTransition(s.id, "pause")}
                          className="text-xs font-semibold px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded inline-flex items-center gap-1"
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </button>
                        <button
                          onClick={() => handleTransition(s.id, "renew")}
                          className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Renew
                        </button>
                        <button
                          onClick={() => handleTransition(s.id, "close")}
                          className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded inline-flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" /> Close
                        </button>
                      </>
                    )}
                    {s.status === "paused" && (
                      <button
                        onClick={() => handleTransition(s.id, "resume")}
                        className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded inline-flex items-center gap-1"
                      >
                        <Play className="h-3 w-3" /> Resume
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
