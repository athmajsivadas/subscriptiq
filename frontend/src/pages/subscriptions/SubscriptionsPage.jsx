import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { AlertCircle, Play, Pause, XCircle, RotateCcw, Plus } from "lucide-react";

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentTerms, setPaymentTerms] = useState(15);
  const [autoRenew, setAutoRenew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const openCreateModal = async () => {
    setIsModalOpen(true);
    try {
      const [cRes, pRes] = await Promise.all([
        client.get("/customers"),
        client.get("/catalog/plans"),
      ]);
      const custs = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.items || []);
      const plns = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || []);
      setCustomers(custs);
      setPlans(plns);
      if (custs.length > 0) setSelectedCustomer(custs[0].id);
      if (plns.length > 0) setSelectedPlan(plns[0].id);
    } catch (err) {
      alert("Failed to load customers or plans: " + err.message);
    }
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedPlan) {
      alert("Please select both a customer and a plan.");
      return;
    }
    const planObj = plans.find((p) => p.id === selectedPlan);
    setSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomer,
        plan_id: selectedPlan,
        start_date: startDate,
        payment_terms_days: parseInt(paymentTerms, 10) || 15,
        auto_renew: autoRenew,
        items: planObj?.product_id ? [{ product_id: planObj.product_id, quantity: 1 }] : [],
      };
      await client.post("/subscriptions", payload);
      setIsModalOpen(false);
      fetchSubscriptions();
    } catch (err) {
      alert("Creation failed: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Subscriptions Lifecycle</h2>
          <p className="text-sm text-slate-500">Manage subscriptions, transitions, cycles, and view status timelines</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Create Subscription Manually
        </button>
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
                        onClick={() => handleTransition(s.id, "confirm")}
                        className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded"
                      >
                        Confirm
                      </button>
                    )}
                    {s.status === "confirmed" && (
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
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Subscription Manually */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Subscription Manually</h3>
            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer *</label>
                <select
                  required
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {customers.length === 0 ? (
                    <option value="">No customers available</option>
                  ) : (
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} (ID: {c.id.slice(0, 8)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Plan *</label>
                <select
                  required
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {plans.length === 0 ? (
                    <option value="">No plans available</option>
                  ) : (
                    plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ₹{p.price} ({p.billing_cycle})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoRenew" className="text-xs font-semibold text-slate-700">
                  Auto Renew Subscription
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedCustomer || !selectedPlan}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
