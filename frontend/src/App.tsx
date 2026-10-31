import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import StaffLayout from "./layouts/StaffLayout";
import CustomerLayout from "./layouts/CustomerLayout";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// Admin / Core Pages
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import TaxRulesPage from "./pages/catalog/TaxRulesPage";
import ProductsPage from "./pages/catalog/ProductsPage";
import PlansPage from "./pages/catalog/PlansPage";
import DiscountsPage from "./pages/catalog/DiscountsPage";
import TemplatesPage from "./pages/catalog/TemplatesPage";
import QuotationsPage from "./pages/quotations/QuotationsPage";
import SubscriptionsPage from "./pages/subscriptions/SubscriptionsPage";
import InvoicesPage from "./pages/invoices/InvoicesPage";
import PaymentsPage from "./pages/payments/PaymentsPage";
import ReportsPage from "./pages/reports/ReportsPage";

// Staff & Customer Pages
import StaffOpsPage from "./pages/staff/StaffOpsPage";
import CustomerPortalPage from "./pages/portal/CustomerPortalPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/tax-rules"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <TaxRulesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/products"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <ProductsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/plans"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <PlansPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/discounts"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <DiscountsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/templates"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <TemplatesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <ReportsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin & Staff Shared Operations */}
          <Route
            path="/quotations"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AdminLayout>
                  <QuotationsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AdminLayout>
                  <SubscriptionsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AdminLayout>
                  <InvoicesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AdminLayout>
                  <PaymentsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Staff Specific Routes */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffLayout>
                  <StaffOpsPage />
                </StaffLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/customers"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffLayout>
                  <StaffOpsPage />
                </StaffLayout>
              </ProtectedRoute>
            }
          />

          {/* Customer Portal */}
          <Route
            path="/portal/*"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <CustomerPortalPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />

          {/* Default Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
