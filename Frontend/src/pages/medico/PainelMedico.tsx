import { Calendar, Users, Clock, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mock data
const consultasHoje = [
  { id: "1", paciente: "Ana Paula Costa", horario: "09:00", tipo: "Retorno" },
  { id: "2", paciente: "Carlos Silva", horario: "10:30", tipo: "Primeira consulta" },
];

const agendaSemana = [
  { dia: "Segunda", consultas: 3 },
  { dia: "Terça", consultas: 5 },
  { dia: "Quarta", consultas: 4 },
  { dia: "Quinta", consultas: 2 },
  { dia: "Sexta", consultas: 6 },
];

export default function PainelMedico() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Olá, Dr. João! 👋</h1>
          <p className="text-muted-foreground">
            Aqui está sua agenda da semana
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Consultas Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Clock className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-3xl font-bold">24</p>
                  <p className="text-sm text-muted-foreground">Horários Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <Users className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-3xl font-bold">156</p>
                  <p className="text-sm text-muted-foreground">Total Pacientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agenda Semanal</CardTitle>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Bloquear Horário
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="font-medium">
                {format(weekStart, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {weekDays.map((day, index) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "text-center p-4 rounded-xl border transition-colors",
                    isToday(day)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p className="text-2xl font-bold mb-2">{format(day, "d")}</p>
                  <p className="text-xs text-muted-foreground">
                    {agendaSemana[index]?.consultas || 0} consultas
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Consultas de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {consultasHoje.length > 0 ? (
              <div className="space-y-3">
                {consultasHoje.map((consulta) => (
                  <div
                    key={consulta.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-medium text-primary">
                          {consulta.paciente.split(" ")[0][0]}
                          {consulta.paciente.split(" ")[1]?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{consulta.paciente}</p>
                        <p className="text-sm text-muted-foreground">
                          {consulta.tipo}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{consulta.horario}</p>
                      <Button variant="link" className="p-0 h-auto text-sm">
                        Ver prontuário
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma consulta agendada para hoje</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
