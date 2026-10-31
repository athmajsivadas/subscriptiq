import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { AlertCircle, CheckCircle, Send, Download, Ban, CheckCheck } from "lucide-react";

export const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/invoices?page=${page}&page_size=15`);
      setInvoices(res.data?.items || []);
      setTotalPages(Math.ceil((res.data?.total || 1) / 15));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page]);

  const handleConfirm = async (id) => {
    try {
      await client.post(`/invoices/${id}/confirm`);
      fetchInvoices();
    } catch (err) {
      alert("Error confirming invoice: " + err.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await client.post(`/invoices/${id}/cancel`);
      fetchInvoices();
    } catch (err) {
      alert("Error cancelling invoice: " + err.message);
    }
  };

  const handleSend = async (id) => {
    try {
      await client.post(`/invoices/${id}/send`);
      alert("Invoice marked as sent and email dispatched to console!");
      fetchInvoices();
    } catch (err) {
      alert("Error sending invoice: " + err.message);
    }
  };

  const handleBulkConfirm = async () => {
    try {
      const res = await client.post("/invoices/bulk-confirm");
      alert(`Bulk confirm complete: ${res.data.confirmed_count} draft invoices confirmed!`);
      fetchInvoices();
    } catch (err) {
      alert("Bulk confirm error: " + err.message);
    }
  };

  const handleDownloadPdf = async (id, invoiceNumber) => {
    try {
      const res = await client.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice_${invoiceNumber || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to download PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">
            View draft, confirmed, paid, and overdue invoices with ReportLab PDF snapshots
          </p>
        </div>
        <button
          onClick={handleBulkConfirm}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <CheckCheck className="h-4 w-4" /> Bulk Confirm Drafts
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          No invoices found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Sub #</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3">Balance</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">
                    {inv.invoice_number || `DRAFT-${inv.id}`}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-700">SUB #{inv.subscription_id}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{inv.due_date}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-indigo-700">₹{parseFloat(inv.balance_due).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : inv.status === "confirmed"
                          ? "bg-blue-50 text-blue-700"
                          : inv.status === "draft"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1.5">
                    {inv.status === "draft" && (
                      <>
                        <button
                          onClick={() => handleConfirm(inv.id)}
                          className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded inline-flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Confirm
                        </button>
                        <button
                          onClick={() => handleCancel(inv.id)}
                          className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded inline-flex items-center gap-1"
                        >
                          <Ban className="h-3 w-3" /> Cancel
                        </button>
                      </>
                    )}
                    {inv.status !== "draft" && (
                      <>
                        <button
                          onClick={() => handleSend(inv.id)}
                          className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded inline-flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" /> Send
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                      </>
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

export default InvoicesPage;
