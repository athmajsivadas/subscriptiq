import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Receipt, CheckCircle, Clock } from "lucide-react";

export const CustomerPortalPage = () => {
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const [sRes, iRes] = await Promise.all([
        client.get("/portal/subscriptions"),
        client.get("/portal/invoices"),
      ]);
      setSubs(sRes.data || []);
      setInvoices(iRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleSubAction = async (id, action) => {
    try {
      await client.post(`/portal/subscriptions/${id}/${action}`);
      fetchPortalData();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDownloadPdf = async (id, number) => {
    try {
      const res = await client.get(`/portal/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice_${number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome to Your Portal</h2>
        <p className="text-sm text-slate-500">Manage your active plans, billing history, and invoices</p>
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-base text-slate-900 mb-4">My Subscriptions</h3>
        {subs.length === 0 ? (
          <p className="text-sm text-slate-400">No active subscriptions found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {subs.map((s) => (
              <div key={s.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Subscription #{s.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      s.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Current Period: {s.current_period_start} to {s.current_period_end} | Next Billing: {s.next_billing_date}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.status === "active" && (
                    <>
                      <button
                        onClick={() => handleSubAction(s.id, "pause")}
                        className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold rounded"
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => handleSubAction(s.id, "renew")}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded"
                      >
                        Renew
                      </button>
                      <button
                        onClick={() => handleSubAction(s.id, "close")}
                        className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold rounded"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {s.status === "paused" && (
                    <button
                      onClick={() => handleSubAction(s.id, "resume")}
                      className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-base text-slate-900 mb-4">My Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices available.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <span className="font-mono font-bold text-slate-900 mr-2">{inv.invoice_number}</span>
                  <span className="text-xs text-slate-500">Due {inv.due_date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900">₹{parseFloat(inv.total_amount).toFixed(2)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                    inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                  }`}>
                    {inv.status}
                  </span>
                  <button
                    onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium"
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalPage;
