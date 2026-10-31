import React, { useState, useEffect } from "react";
import client from "../../api/client";
import { ShieldCheck, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye, Clock, User, Tag } from "lucide-react";

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  // Modal for Viewing Metadata
  const [selectedMeta, setSelectedMeta] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (actionFilter.trim()) params.append("action", actionFilter.trim());
      if (entityFilter) params.append("entity_type", entityFilter);

      const res = await client.get(`/audit-logs?${params.toString()}`);
      setLogs(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const getActionBadgeColor = (action) => {
    if (action.includes("payment")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (action.includes("confirm")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (action.includes("cancel") || action.includes("reject")) return "bg-red-50 text-red-700 border-red-200";
    if (action.includes("create") || action.includes("convert")) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">System Audit Trail</h2>
          </div>
          <p className="text-sm text-slate-500">
            Immutable compliance record of all administrative, financial, and lifecycle events
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          Refresh Log
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action (e.g. payment)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs uppercase font-semibold text-slate-500">Entity:</span>
          </div>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Entities</option>
            <option value="invoice">Invoices</option>
            <option value="subscription">Subscriptions</option>
            <option value="user">Users & Staff</option>
            <option value="discount">Discounts</option>
          </select>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Total Events: <strong className="text-slate-800">{total}</strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading audit trail entries...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No audit events found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Timestamp (UTC / IST)</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Actor</th>
                  <th className="px-6 py-3.5">Target Entity</th>
                  <th className="px-6 py-3.5">Metadata / Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => {
                  const dateObj = new Date(log.created_at);
                  const formattedDate = dateObj.toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                  const formattedTime = dateObj.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <div className="font-medium text-slate-900">{formattedDate}</div>
                        <div>{formattedTime}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div className="font-semibold text-slate-900">{log.actor_name || "System"}</div>
                        <div className="text-slate-500">{log.actor_email || "system@brightloop"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className="capitalize font-medium text-slate-800">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="block text-[11px] text-slate-400 font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {log.meta && Object.keys(log.meta).length > 0 ? (
                          <button
                            onClick={() => setSelectedMeta({ action: log.action, meta: log.meta })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium cursor-pointer transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> View JSON Details
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-sm">
          <span className="text-xs text-slate-500">
            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong> (
            {total} total records)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Metadata Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Audit Event Payload: <span className="text-indigo-600">{selectedMeta.action}</span>
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-80">
              {JSON.stringify(selectedMeta.meta, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedMeta(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
