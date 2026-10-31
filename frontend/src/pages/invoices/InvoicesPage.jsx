import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { AlertCircle, CheckCircle, Send, Download, Ban, CheckCheck, Eye, X } from "lucide-react";

export const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const viewInvoiceDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await client.get(`/invoices/${id}`);
      setSelectedInvoice(res.data);
    } catch (err) {
      alert("Failed to load invoice details: " + err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await client.post(`/invoices/${id}/confirm`);
      fetchInvoices();
      if (selectedInvoice?.id === id) viewInvoiceDetail(id);
    } catch (err) {
      alert("Error confirming invoice: " + err.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await client.post(`/invoices/${id}/cancel`);
      fetchInvoices();
      if (selectedInvoice?.id === id) viewInvoiceDetail(id);
    } catch (err) {
      alert("Error cancelling invoice: " + err.message);
    }
  };

  const handleSend = async (id) => {
    try {
      await client.post(`/invoices/${id}/send`);
      alert("Invoice marked as sent and email dispatched to console!");
      fetchInvoices();
      if (selectedInvoice?.id === id) viewInvoiceDetail(id);
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

  const handleExportCsv = async () => {
    try {
      const res = await client.get("/invoices/export/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoices_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to export invoices CSV: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">
            View draft, confirmed, paid, and overdue invoices with ReportLab PDF snapshots
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={handleBulkConfirm}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <CheckCheck className="h-4 w-4" /> Bulk Confirm Drafts
          </button>
        </div>
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
                    <button
                      onClick={() => viewInvoiceDetail(inv.id)}
                      className="text-indigo-600 hover:text-indigo-900 underline underline-offset-2 flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      {inv.invoice_number || `DRAFT-${inv.id.slice(0, 8)}`}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-700">SUB #{inv.subscription_id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{inv.due_date}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">₹{parseFloat(inv.grand_total || inv.total_amount || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-indigo-700">₹{parseFloat(inv.balance_due || 0).toFixed(2)}</td>
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
                    <button
                      onClick={() => viewInvoiceDetail(inv.id)}
                      className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded"
                    >
                      View
                    </button>
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

      {/* Invoice Detail Modal: lines, discount, tax, totals */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-mono text-slate-900">
                    {selectedInvoice.invoice_number || `DRAFT-${selectedInvoice.id.slice(0, 8)}`}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      selectedInvoice.status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedInvoice.status === "confirmed"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selectedInvoice.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Customer ID: {selectedInvoice.customer_id} | Subscription ID: {selectedInvoice.subscription_id}
                </p>
                <p className="text-xs text-slate-500">
                  Billing Period: {selectedInvoice.billing_period_start} to {selectedInvoice.billing_period_end} | Due Date: {selectedInvoice.due_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider text-xs">
                Invoice Line Items ({selectedInvoice.items?.length || 0})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">Discount</th>
                      <th className="px-4 py-2.5 text-right">Tax (%)</th>
                      <th className="px-4 py-2.5 text-right">Tax Amt</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedInvoice.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.description_snapshot}</td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                          {parseFloat(item.discount_amount || 0) > 0 ? `-₹${parseFloat(item.discount_amount).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">{parseFloat(item.tax_rate_percent || 0).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">₹{parseFloat(item.tax_amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">₹{parseFloat(item.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-64 bg-slate-50 rounded-xl p-4 space-y-2 text-sm border border-slate-100">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Discount Total:</span>
                  <span>-₹{parseFloat(selectedInvoice.discount_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax Total:</span>
                  <span>₹{parseFloat(selectedInvoice.tax_total).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base text-slate-900">
                  <span>Grand Total:</span>
                  <span>₹{parseFloat(selectedInvoice.grand_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-semibold text-emerald-700">₹{parseFloat(selectedInvoice.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-indigo-700 font-bold border-t border-slate-200 pt-1">
                  <span>Balance Due:</span>
                  <span>₹{parseFloat(selectedInvoice.balance_due).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions in Modal */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoice_number)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg"
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <div className="space-x-2">
                {selectedInvoice.status === "draft" && (
                  <button
                    onClick={() => handleConfirm(selectedInvoice.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Confirm Invoice
                  </button>
                )}
                {selectedInvoice.status !== "draft" && (
                  <button
                    onClick={() => handleSend(selectedInvoice.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Send Invoice Email
                  </button>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
