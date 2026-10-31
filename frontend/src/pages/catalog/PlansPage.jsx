import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react";

export const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [billingInterval, setBillingInterval] = useState("monthly");
  const [productId, setProductId] = useState("");
  const [minQuantity, setMinQuantity] = useState(1);
  const [autoClose, setAutoClose] = useState(true);
  const [allowPause, setAllowPause] = useState(true);
  const [allowRenewal, setAllowRenewal] = useState(true);
  const [allowCustomerClose, setAllowCustomerClose] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, prodsRes] = await Promise.all([
        client.get("/plans"),
        client.get("/products"),
      ]);
      setPlans(plansRes.data || []);
      setProducts(prodsRes.data || []);
      if (prodsRes.data?.length > 0) {
        setProductId(prodsRes.data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.post("/plans", {
        name,
        code,
        billing_interval: billingInterval,
        product_id: parseInt(productId),
        min_quantity: parseInt(minQuantity),
        auto_close_on_end: autoClose,
        allow_pause: allowPause,
        allow_renewal: allowRenewal,
        allow_customer_close: allowCustomerClose,
        is_active: true,
      });
      setShowModal(false);
      setName("");
      setCode("");
      fetchData();
    } catch (err) {
      alert("Error creating plan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Subscription Plans</h2>
          <p className="text-sm text-slate-500">
            Define recurring cycles (weekly, monthly, quarterly, yearly) and lifecycle flags
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Plan
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No plans found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700">
                    {p.billing_interval}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-500 mb-3">{p.code}</p>

                <div className="space-y-1.5 py-3 border-y border-slate-100 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Base Product:</span>
                    <strong className="text-slate-800">
                      {products.find((prod) => prod.id === p.product_id)?.name || `ID #${p.product_id}`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Quantity:</span>
                    <strong className="text-slate-800">{p.min_quantity}</strong>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${p.allow_pause ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span>Pause allowed: {p.allow_pause ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${p.allow_renewal ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span>Renewal: {p.allow_renewal ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${p.allow_customer_close ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span>Self-Close: {p.allow_customer_close ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${p.auto_close_on_end ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span>Auto-close: {p.auto_close_on_end ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    p.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.is_active ? "Active" : "Archived"}
                </span>
                <span className="text-slate-400">ID #{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Subscription Plan</h3>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Monthly"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="PLAN-ENT-M"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Interval</label>
                  <select
                    value={billingInterval}
                    onChange={(e) => setBillingInterval(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Product</label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {products.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Lifecycle flags */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPause}
                    onChange={(e) => setAllowPause(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow Pause</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRenewal}
                    onChange={(e) => setAllowRenewal(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow Renewal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCustomerClose}
                    onChange={(e) => setAllowCustomerClose(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow Customer Close</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoClose}
                    onChange={(e) => setAutoClose(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Auto-close on End</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? "Saving..." : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlansPage;
