import { Navigate, Outlet } from "react-router-dom";
import { resolveHomePath, useAuth } from "@/contexts/AuthContext";

export function PublicOnlyRoute() {
  const { status, session } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card px-6 py-4 shadow-card">
          <p className="text-sm text-muted-foreground">Carregando sessao...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to={resolveHomePath(session.userType)} replace />;
  }

  return <Outlet />;
}
