import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Layers, CheckCircle2, AlertCircle } from "lucide-react";

export const PortalPlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await client.get("/portal/plans");
        setPlans(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      } catch (err) {
        setError(err.message || "Failed to load plans");
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading subscription plans...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Available Subscription Plans</h2>
        <p className="text-sm text-slate-500">Explore tiers and packages offered by SubscriptIQ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-indigo-50 text-indigo-700 tracking-wider">
                  {plan.billing_cycle}
                </span>
                <span className="text-xs text-slate-400 font-mono">Plan #{plan.id.slice(0, 8)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{plan.description || "Comprehensive recurring SaaS package."}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-slate-900">₹{parseFloat(plan.price).toFixed(2)}</span>
                <span className="text-xs text-slate-400 ml-1">/ {plan.billing_cycle}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Available
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalPlansPage;
