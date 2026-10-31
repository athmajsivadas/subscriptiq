import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import StaffLayout from "./layouts/StaffLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import AppLayout from "./layouts/AppLayout";

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
import CustomersPage from "./pages/customers/CustomersPage";
import StaffOpsPage from "./pages/staff/StaffOpsPage";
import CustomerPortalPage from "./pages/portal/CustomerPortalPage";
import PortalPlansPage from "./pages/portal/PortalPlansPage";
import PortalSubscriptionsPage from "./pages/portal/PortalSubscriptionsPage";
import PortalInvoicesPage from "./pages/portal/PortalInvoicesPage";
import PortalPaymentsPage from "./pages/portal/PortalPaymentsPage";
import PortalProfilePage from "./pages/portal/PortalProfilePage";

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
                <AppLayout>
                  <QuotationsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AppLayout>
                  <SubscriptionsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AppLayout>
                  <InvoicesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AppLayout>
                  <PaymentsPage />
                </AppLayout>
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

          {/* Shared Admin & Staff Routes */}
          <Route
            path="/customers"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AppLayout>
                  <CustomersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/staff/customers" element={<Navigate to="/customers" replace />} />
          <Route path="/plans" element={<Navigate to="/catalog/plans" replace />} />

          {/* Customer Portal */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <CustomerPortalPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/plans"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <PortalPlansPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/subscriptions"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <PortalSubscriptionsPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/invoices"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <PortalInvoicesPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/payments"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <PortalPaymentsPage />
                </CustomerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/profile"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout>
                  <PortalProfilePage />
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
