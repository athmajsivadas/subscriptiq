import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Plus, AlertCircle, FileText } from "lucide-react";

export const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("");
  const [validityDays, setValidityDays] = useState(30);
  const [lines, setLines] = useState([{ product_id: "", quantity: 1, unit_price: "1000.00" }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, prRes] = await Promise.all([
        client.get("/quotation-templates"),
        client.get("/plans"),
        client.get("/products"),
      ]);
      setTemplates(tRes.data || []);
      setPlans(pRes.data || []);
      setProducts(prRes.data || []);
      if (pRes.data?.length > 0) setPlanId(pRes.data[0].id);
      if (prRes.data?.length > 0) setLines([{ product_id: prRes.data[0].id, quantity: 1, unit_price: prRes.data[0].base_price }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.post("/quotation-templates", {
        name,
        plan_id: parseInt(planId),
        validity_days: parseInt(validityDays),
        lines: lines.map((l) => ({
          product_id: parseInt(l.product_id),
          quantity: parseInt(l.quantity),
          unit_price: parseFloat(l.unit_price),
        })),
        is_active: true,
      });
      setShowModal(false);
      setName("");
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quotation Templates</h2>
          <p className="text-sm text-slate-500">Reusable quotation presets with preset lines and plan configurations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Template
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No quotation templates found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-base text-slate-900">{t.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                  Valid: {t.validity_days} days
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Target Plan: <strong className="text-slate-800">{plans.find((p) => p.id === t.plan_id)?.name || `Plan #${t.plan_id}`}</strong>
              </p>
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Preset Lines:</span> {t.lines?.length || 0} line items
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Quotation Template</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard SaaS Package"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
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
                  {submitting ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
