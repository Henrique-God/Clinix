import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar as CalendarIcon, List, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Mock data
const proximasConsultas = [
  {
    id: "1",
    especialidade: "Cardiologia",
    medico: "Dr. João Silva",
    data: new Date(2026, 1, 5, 9, 30),
    tipo: "Presencial",
  },
];

const consultasConcluidas = [
  {
    id: "2",
    especialidade: "Dermatologia",
    medico: "Dr. Pedro Costa",
    data: new Date(2026, 0, 15, 14, 0),
    tipo: "Teleconsulta",
  },
];

export default function MinhasConsultas() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  return (
    <PatientLayout>
      <div className="animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Minhas Consultas</h1>
            <p className="text-muted-foreground">Gerencie seus agendamentos</p>
          </div>

          <Button onClick={() => navigate("/agendar/especialidade")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Consulta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Próximas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Clock className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex justify-end mb-4">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "list"
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "calendar"
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Tabs defaultValue="proximas">
          <TabsList className="mb-4">
            <TabsTrigger value="proximas">Próximas</TabsTrigger>
            <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          </TabsList>

          <TabsContent value="proximas">
            {proximasConsultas.length > 0 ? (
              <div className="space-y-4">
                {proximasConsultas.map((consulta) => (
                  <Card key={consulta.id} className="p-4 card-hover">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{consulta.especialidade}</h3>
                          <p className="text-sm text-muted-foreground">
                            {consulta.medico}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            <span>
                              {format(consulta.data, "EEEE, d 'de' MMMM", {
                                locale: ptBR,
                              })}
                            </span>
                            <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                            <span>{format(consulta.data, "HH:mm")}</span>
                          </div>
                        </div>
                      </div>
                      <span className="status-badge status-scheduled">
                        {consulta.tipo}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Nenhuma consulta agendada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agende sua primeira consulta
                </p>
                <Button onClick={() => navigate("/agendar/especialidade")}>
                  Agendar consulta
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="concluidas">
            {consultasConcluidas.length > 0 ? (
              <div className="space-y-4">
                {consultasConcluidas.map((consulta) => (
                  <Card key={consulta.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-success" />
                        </div>
                        <div>
                          <h3 className="font-medium">{consulta.especialidade}</h3>
                          <p className="text-sm text-muted-foreground">
                            {consulta.medico}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <CalendarIcon className="w-4 h-4" />
                            <span>
                              {format(consulta.data, "d 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="status-badge status-completed">
                        Concluída
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  Nenhuma consulta concluída ainda
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
}
