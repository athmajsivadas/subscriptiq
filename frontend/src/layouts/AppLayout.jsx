import React from "react";
import { useAuth } from "../context/AuthContext";
import AdminLayout from "./AdminLayout";
import StaffLayout from "./StaffLayout";
import CustomerLayout from "./CustomerLayout";

export const AppLayout = ({ children }) => {
  const { user } = useAuth();

  if (user?.role === "staff") {
    return <StaffLayout>{children}</StaffLayout>;
  }
  if (user?.role === "customer") {
    return <CustomerLayout>{children}</CustomerLayout>;
  }
  return <AdminLayout>{children}</AdminLayout>;
};

export default AppLayout;
