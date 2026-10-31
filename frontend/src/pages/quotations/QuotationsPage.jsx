import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Plus, AlertCircle, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export const QuotationsPage = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await client.get("/quotations");
      setQuotes(res.data?.items || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const handleAction = async (quoteId, action) => {
    try {
      await client.post(`/quotations/${quoteId}/${action}`);
      fetchQuotes();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleConvert = async (quoteId) => {
    try {
      const res = await client.post(`/quotations/${quoteId}/convert`);
      alert(`Successfully converted quotation to Subscription #${res.data.id}!`);
      fetchQuotes();
    } catch (err) {
      alert(`Conversion failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Quotations</h2>
        <p className="text-sm text-slate-500">Manage quotations, approvals, and one-click subscription conversion</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading quotations...</div>
      ) : quotes.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No quotations found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Quote #</th>
                <th className="px-6 py-3">Customer ID</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3">Valid Until</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">QT-{q.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">Cust #{q.customer_id}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">₹{parseFloat(q.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{q.valid_until}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        q.status === "draft"
                          ? "bg-slate-100 text-slate-700"
                          : q.status === "sent"
                          ? "bg-blue-50 text-blue-700"
                          : q.status === "accepted"
                          ? "bg-emerald-50 text-emerald-700"
                          : q.status === "converted"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {q.status === "draft" && (
                      <button
                        onClick={() => handleAction(q.id, "send")}
                        className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded"
                      >
                        Send
                      </button>
                    )}
                    {q.status === "sent" && (
                      <>
                        <button
                          onClick={() => handleAction(q.id, "accept")}
                          className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleAction(q.id, "reject")}
                          className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {q.status === "accepted" && (
                      <button
                        onClick={() => handleConvert(q.id)}
                        className="text-xs font-bold px-3 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded shadow-sm inline-flex items-center gap-1"
                      >
                        Convert to Sub <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QuotationsPage;
