import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, FileText, LogOut, MessageSquare } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface PatientLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { id: "consultas", label: "Agendamentos", icon: Calendar, path: "/paciente/consultas" },
  { id: "prontuario", label: "Prontuario", icon: FileText, path: "/paciente/prontuario" },
  { id: "assistente", label: "Assistente", icon: MessageSquare, path: "/paciente/assistente" },
];

export function PatientLayout({ children }: PatientLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, profile } = useAuth();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="md" />

            <nav className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium">{profile?.name ?? "Paciente"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email ?? ""}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        <nav className="md:hidden flex border-t border-border">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
