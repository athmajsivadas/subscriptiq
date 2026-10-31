import React, { useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [devToken, setDevToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDevToken(null);
    setSubmitting(true);
    try {
      const res = await client.post("/auth/forgot-password", { email });
      if (res.data?.dev_reset_token) {
        setDevToken(res.data.dev_reset_token);
      } else {
        setDevToken("sent");
      }
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your email to receive a reset token</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {devToken && (
          <div className="mb-4 p-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Reset instructions sent!</span>
            </div>
            {devToken !== "sent" && (
              <div>
                <p className="text-xs text-slate-600 mb-1">
                  (Dev simulation token generated):
                </p>
                <code className="block p-2 bg-white rounded border border-emerald-200 font-mono text-xs break-all">
                  {devToken}
                </code>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="mt-3 inline-block text-xs font-semibold text-emerald-700 underline"
                >
                  Proceed to Reset Form &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="you@brightloop.test"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
          >
            {submitting ? "Sending..." : "Request Reset"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/login" className="text-indigo-600 font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
