"use client";

import { AdminDashboard } from "@/app/components/AdminDashboard";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";

export default function AdminPage() {
  return (
    <ProtectedRoute role="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
