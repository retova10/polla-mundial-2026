import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/AuthContext";
import type { Role } from "../types/database";
import PendingApproval from "../pages/PendingApproval";

interface Props {
  children: ReactNode;
  requireRole?: Role;
}

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        Cargando…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Admins siempre pasan; jugadores requieren is_approved
  if (profile && profile.role !== "admin" && !profile.is_approved) {
    return <PendingApproval />;
  }

  if (requireRole && profile?.role !== requireRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
