import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Download, CreditCard, CheckCircle, AlertCircle, QrCode, ShieldCheck, X } from "lucide-react";

export const PortalInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pay Modal State
  const [payInvoice, setPayInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("upi");
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(null);
  const [payError, setPayError] = useState(null);

  const fetchInvoices = async () => {
    try {
      const res = await client.get("/portal/invoices");
      setInvoices(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePdf = async (id, number) => {
    try {
      const res = await client.get(`/portal/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${number || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("PDF error: " + (err.message || "Error generating PDF"));
    }
  };

  const openPayModal = (inv) => {
    setPayInvoice(inv);
    setPayAmount(parseFloat(inv.balance_due || inv.grand_total || 0).toFixed(2));
    setPayMethod("upi");
    setPaySuccess(null);
    setPayError(null);
  };

  const closePayModal = () => {
    setPayInvoice(null);
    setPaySuccess(null);
    setPayError(null);
  };

  const handleExecutePayment = async (e) => {
    e.preventDefault();
    if (!payInvoice) return;
    setPaying(true);
    setPayError(null);
    setPaySuccess(null);

    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`;

    try {
      const payload = {
        amount: parseFloat(payAmount),
        method: payMethod,
        idempotency_key: idempotencyKey,
        payment_reference: `PORTAL-${payMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        note: `Self-service payment via Customer Portal (${payMethod.toUpperCase()})`,
      };

      const res = await client.post(`/portal/invoices/${payInvoice.id}/pay`, payload);
      setPaySuccess({
        reference: res.data.payment_reference,
        amount: res.data.amount,
      });
      fetchInvoices();
    } catch (err) {
      setPayError(err.message || "Payment processing failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading your invoices...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Invoices ({invoices.length})</h2>
        <p className="text-sm text-slate-500">
          Review billing statements, settle balances online, and download tax invoices
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
          No billing statements found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
          {invoices.map((inv) => {
            const grandTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
            const balanceDue = parseFloat(inv.balance_due ?? grandTotal);
            const isPayable = inv.status === "confirmed" && balanceDue > 0;

            return (
              <div
                key={inv.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{inv.invoice_number}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : inv.is_overdue
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {inv.is_overdue ? "Overdue" : inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>Due: <strong>{inv.due_date}</strong></span>
                    <span>·</span>
                    <span>Period: {inv.billing_period_start} to {inv.billing_period_end}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-base">₹{grandTotal.toFixed(2)}</div>
                    {balanceDue > 0 ? (
                      <div className="text-xs font-semibold text-red-600">
                        Balance: ₹{balanceDue.toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-emerald-600">Settled in Full</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPayable && (
                      <button
                        onClick={() => openPayModal(inv)}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => handlePdf(inv.id, inv.invoice_number)}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay Now Modal */}
      {payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Pay Invoice: <span className="font-mono text-indigo-600">{payInvoice.invoice_number}</span>
                </h3>
              </div>
              <button onClick={closePayModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                ✕
              </button>
            </div>

            {paySuccess ? (
              <div className="space-y-4 py-3 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Payment Successful!</h4>
                <p className="text-xs text-slate-500">
                  Your payment of <strong>₹{parseFloat(paySuccess.amount).toFixed(2)}</strong> has been recorded.
                  <br />
                  Reference: <span className="font-mono font-semibold">{paySuccess.reference}</span>
                </p>
                <button
                  onClick={closePayModal}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecutePayment} className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total Outstanding Due:</span>
                  <span className="font-bold text-slate-900 text-base">
                    ₹{parseFloat(payInvoice.balance_due || payInvoice.grand_total || 0).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={parseFloat(payInvoice.balance_due || payInvoice.grand_total || 0)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">You can pay in full or make a partial payment.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Payment Method</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPayMethod("upi")}
                      className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                        payMethod === "upi"
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-800 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <QrCode className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod("card")}
                      className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                        payMethod === "card"
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-800 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="h-4 w-4 mx-auto mb-1 text-indigo-600" />
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod("bank_transfer")}
                      className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                        payMethod === "bank_transfer"
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-800 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                      NetBanking
                    </button>
                  </div>
                </div>

                {payError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{payError}</span>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={closePayModal}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paying}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {paying ? "Processing..." : `Pay ₹${parseFloat(payAmount || 0).toFixed(2)}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalInvoicesPage;
