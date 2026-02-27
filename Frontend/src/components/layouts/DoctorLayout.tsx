import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Calendar,
  Users,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  Clock,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface DoctorLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { id: "agenda", label: "Agenda", icon: Calendar, path: "/medico/painel" },
  { id: "horarios", label: "Horários", icon: Clock, path: "/medico/horarios" },
  { id: "pacientes", label: "Pacientes", icon: Users, path: "/medico/pacientes" },
  { id: "prontuarios", label: "Prontuários", icon: FileText, path: "/medico/prontuarios" },
  { id: "assistente", label: "Assistente", icon: MessageSquare, path: "/medico/assistente" },
];

export function DoctorLayout({ children }: DoctorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
        <div className="p-6">
          <Logo size="md" />
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn("nav-item w-full", isActive && "active")}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => navigate("/")}
            className="nav-item w-full text-destructive hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden bg-card border-b border-border sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 h-16">
            <Logo size="sm" />
            <button
              onClick={() => navigate("/")}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex border-t border-border overflow-x-auto">
            {menuItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex-1 min-w-[80px] flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
