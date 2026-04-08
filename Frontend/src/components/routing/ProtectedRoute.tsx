import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppUserType } from "@/lib/api/contracts";
import { resolveHomePath, useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  allowedUserTypes: AppUserType[];
}

export function ProtectedRoute({ allowedUserTypes }: ProtectedRouteProps) {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card px-6 py-4 shadow-card">
          <p className="text-sm text-muted-foreground">Carregando sessao...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!allowedUserTypes.includes(session.userType)) {
    return <Navigate to={resolveHomePath(session.userType)} replace />;
  }

  return <Outlet />;
}
