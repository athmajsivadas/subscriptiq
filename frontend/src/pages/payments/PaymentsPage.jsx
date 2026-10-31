import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { Plus, AlertCircle, CreditCard, CheckCircle2 } from "lucide-react";

export const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Record Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [payRes, invRes] = await Promise.all([
        client.get(`/payments?page=${page}&page_size=15`),
        client.get("/invoices?page=1&page_size=50"),
      ]);
      setPayments(payRes.data?.items || []);
      setTotalPages(Math.ceil((payRes.data?.total || 1) / 15));
      const confirmedInvs = (invRes.data?.items || []).filter(i => i.status === "confirmed" && parseFloat(i.balance_due) > 0);
      setInvoices(confirmedInvs);
      if (confirmedInvs.length > 0) {
        setInvoiceId(confirmedInvs[0].id);
        setAmount(confirmedInvs[0].balance_due);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Required per spec §14: client generates idempotency key
      const idempotencyKey = crypto.randomUUID();
      await client.post(
        "/payments",
        {
          invoice_id: parseInt(invoiceId),
          amount: parseFloat(amount),
          payment_method: paymentMethod,
        },
        {
          headers: { "Idempotency-Key": idempotencyKey },
        }
      );
      setShowModal(false);
      alert("Payment recorded successfully!");
      fetchPayments();
    } catch (err) {
      alert("Payment error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payments & Collections</h2>
          <p className="text-sm text-slate-500">
            Idempotent payment ledger with atomic invoice balance updates
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Record Payment
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading payments...</div>
      ) : payments.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No payments recorded yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Payment #</th>
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Paid At</th>
                <th className="px-6 py-3">Idempotency Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">PAY-{p.id}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-700">INV #{p.invoice_id}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600">₹{parseFloat(p.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{p.created_at || "-"}</td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400 truncate max-w-xs">
                    {p.idempotency_key}
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

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Record Payment</h3>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Confirmed Invoice</label>
                <select
                  value={invoiceId}
                  onChange={(e) => {
                    setInvoiceId(e.target.value);
                    const inv = invoices.find(i => i.id === parseInt(e.target.value));
                    if (inv) setAmount(inv.balance_due);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} (Due: ₹{inv.balance_due})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="bank_transfer">Bank Transfer / UPI</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash / Cheque</option>
                </select>
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
                  disabled={submitting || !invoiceId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? "Processing..." : "Submit Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
