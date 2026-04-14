import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  FileText,
  LogOut,
  MessageSquare,
  UserCircle2,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface DoctorLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { id: "agenda", label: "Agenda", icon: Calendar, path: "/medico/painel" },
  { id: "horarios", label: "Horários", icon: Clock, path: "/medico/horarios" },
  { id: "pacientes", label: "Pacientes", icon: Users, path: "/medico/pacientes" },
  { id: "prontuarios", label: "Prontuários", icon: FileText, path: "/medico/prontuarios" },
  { id: "perfil", label: "Meu perfil", icon: UserCircle2, path: "/medico/perfil" },
  { id: "assistente", label: "Assistente", icon: MessageSquare, path: "/medico/assistente" },
];

function matchesPath(currentPath: string, itemPath: string) {
  if (currentPath === itemPath) {
    return true;
  }

  if (itemPath === "/medico/prontuarios" && currentPath.startsWith("/medico/prontuario/")) {
    return true;
  }

  return false;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, profile } = useAuth();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card lg:sticky lg:top-0 lg:h-screen">
        <div className="px-5 py-6">
          <Logo size="md" />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = matchesPath(location.pathname, item.path);

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn("nav-item w-full", isActive && "active")}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-2xl bg-secondary/50 px-4 py-3">
            <p className="text-sm font-medium">{profile?.name ?? "Médico"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile?.professionalRegister ?? profile?.email ?? ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item mt-3 w-full text-destructive hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-card lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Logo size="sm" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/medico/perfil")}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                Perfil
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex border-t border-border overflow-x-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = matchesPath(location.pathname, item.path);

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex min-w-[84px] flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
