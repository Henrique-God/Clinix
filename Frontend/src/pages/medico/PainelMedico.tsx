import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api/clinix-api";
import {
  getAppointmentStatusLabel,
  getInitials,
  resolveAppointmentStatus,
} from "@/lib/api/domain";
import { formatDateTime, formatTimeLabel } from "@/lib/date-utils";
import { loadDirectoryUsers } from "@/lib/directory";

function buildIsoRange(date: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

export default function PainelMedico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    title: "Horario bloqueado",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "doctor", "dashboard"],
    queryFn: () => appointmentsApi.listDoctorAppointments(session!.token),
    enabled: Boolean(session?.token),
  });

  const calendarQuery = useQuery({
    queryKey: ["appointments", "calendar", profile?.userId, weekStart.toISOString()],
    queryFn: () =>
      appointmentsApi.getCalendar(session!.token, profile!.userId, {
        fromUtc: weekStart.toISOString(),
        toUtc: addDays(weekStart, 7).toISOString(),
      }),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const directoryUsersQuery = useQuery({
    queryKey: [
      "directory",
      "users",
      "doctor-dashboard",
      ...(appointmentsQuery.data ?? []).map((appointment) => appointment.patientId).sort(),
    ],
    queryFn: () =>
      loadDirectoryUsers(
        session!.token,
        (appointmentsQuery.data ?? []).map((appointment) => appointment.patientId),
      ),
    enabled: Boolean(session?.token && appointmentsQuery.data?.length),
  });

  const createBlockedSlotMutation = useMutation({
    mutationFn: () =>
      appointmentsApi.createCalendarEvent(session!.token, profile!.userId, {
        type: "BlockedSlot",
        title: blockForm.title.trim(),
        description: blockForm.description.trim(),
        startTime: buildIsoRange(blockForm.date, blockForm.startTime),
        endTime: buildIsoRange(blockForm.date, blockForm.endTime),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
      setDialogOpen(false);
      setBlockForm({
        title: "Horario bloqueado",
        description: "",
        date: "",
        startTime: "",
        endTime: "",
      });
      toast({
        title: "Bloqueio criado",
        description: "O periodo foi reservado na agenda do medico.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel bloquear o horario",
        description:
          error instanceof Error ? error.message : "Confira os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const completeAppointmentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      appointmentsApi.completeAppointment(session!.token, appointmentId, {
        createClinicalRecordEntry: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "doctor"] });
      await queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
      toast({
        title: "Consulta concluida",
        description: "A consulta foi marcada como concluida e a integracao clinica foi acionada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel concluir a consulta",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const todayAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const status = resolveAppointmentStatus(appointment.status);
        return isSameDay(parseISO(appointment.startTime), new Date()) && (status === "Accepted" || status === "Completed");
      }),
    [appointments],
  );

  const uniquePatientsCount = new Set(appointments.map((appointment) => appointment.patientId)).size;

  function getPatientName(patientId: string) {
    return directoryUsersQuery.data?.[patientId]?.name ?? "Paciente";
  }

  function handleCreateBlockedSlot() {
    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime || !blockForm.title.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Informe data, horario inicial, final e titulo do bloqueio.",
        variant: "destructive",
      });
      return;
    }

    createBlockedSlotMutation.mutate();
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Ola, {profile?.name ?? "medico"}</h1>
          <p className="text-muted-foreground">Resumo da sua agenda e das consultas do dia.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{todayAppointments.length}</p>
                  <p className="text-sm text-muted-foreground">Consultas hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Calendar className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{calendarQuery.data?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Eventos na semana</p>
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
                  <p className="text-3xl font-bold">{uniquePatientsCount}</p>
                  <p className="text-sm text-muted-foreground">Pacientes atendidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agenda semanal</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Bloquear horario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo bloqueio de agenda</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titulo</Label>
                    <Input
                      value={blockForm.title}
                      onChange={(event) =>
                        setBlockForm((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descricao</Label>
                    <Textarea
                      value={blockForm.description}
                      onChange={(event) =>
                        setBlockForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={blockForm.date}
                      onChange={(event) =>
                        setBlockForm((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Inicio</Label>
                      <Input
                        type="time"
                        value={blockForm.startTime}
                        onChange={(event) =>
                          setBlockForm((current) => ({ ...current, startTime: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input
                        type="time"
                        value={blockForm.endTime}
                        onChange={(event) =>
                          setBlockForm((current) => ({ ...current, endTime: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateBlockedSlot} className="w-full">
                    {createBlockedSlotMutation.isPending ? "Salvando..." : "Criar bloqueio"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
              {weekDays.map((day) => {
                const totalEvents =
                  (calendarQuery.data ?? []).filter((event) =>
                    isSameDay(parseISO(event.startTime), day),
                  ).length;

                return (
                  <div
                    key={day.toISOString()}
                    className="text-center p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                  >
                    <p className="text-sm text-muted-foreground mb-1">
                      {format(day, "EEE", { locale: ptBR })}
                    </p>
                    <p className="text-2xl font-bold mb-2">{format(day, "d")}</p>
                    <p className="text-xs text-muted-foreground">{totalEvents} evento(s)</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consultas de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando consultas...</div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const status = resolveAppointmentStatus(appointment.status);
                  const canComplete = status === "Accepted" && new Date(appointment.startTime) <= new Date();

                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-medium text-primary">
                            {getInitials(getPatientName(appointment.patientId))}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{getPatientName(appointment.patientId)}</p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatTimeLabel(appointment.startTime)} • {getAppointmentStatusLabel(status)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/medico/prontuario/${appointment.patientId}`)}
                        >
                          Ver prontuario
                        </Button>
                        {canComplete ? (
                          <Button
                            onClick={() => completeAppointmentMutation.mutate(appointment.id)}
                            disabled={completeAppointmentMutation.isPending}
                          >
                            Concluir consulta
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma consulta registrada para hoje.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
