import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
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
import {
  buildDoctorWeekDays,
  buildIsoRangeForDate,
  buildWeeklyCalendarItems,
  getDoctorWeekStart,
} from "@/lib/doctor-schedule";
import { formatTimeLabel } from "@/lib/date-utils";
import { loadDirectoryUsers } from "@/lib/directory";

export default function PainelMedico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(getDoctorWeekStart(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({
    title: "Horario bloqueado",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
  });

  const weekDays = useMemo(() => buildDoctorWeekDays(weekStart), [weekStart]);

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
        startTime: buildIsoRangeForDate(new Date(blockForm.date), blockForm.startTime),
        endTime: buildIsoRangeForDate(new Date(blockForm.date), blockForm.endTime),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
      setDialogOpen(false);
      setBlockForm({
        title: "Horario bloqueado",
        description: "",
        date: format(weekStart, "yyyy-MM-dd"),
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
        return (
          isSameDay(parseISO(appointment.startTime), new Date()) &&
          (status === "Accepted" || status === "Completed")
        );
      }),
    [appointments],
  );

  const weeklyCalendarItems = useMemo(
    () => buildWeeklyCalendarItems([], calendarQuery.data ?? []),
    [calendarQuery.data],
  );

  const selectedCalendarItem =
    weeklyCalendarItems.find((item) => item.id === selectedCalendarItemId) ??
    weeklyCalendarItems[0] ??
    null;

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
          <p className="text-muted-foreground">Resumo da sua agenda Clinix e das consultas do dia.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Calendar className="h-6 w-6 text-primary" />
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
                <div className="rounded-xl bg-info/10 p-3">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{weeklyCalendarItems.length}</p>
                  <p className="text-sm text-muted-foreground">Eventos nesta semana</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-success/10 p-3">
                  <Users className="h-6 w-6 text-success" />
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
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Agenda semanal</CardTitle>
              <p className="text-sm text-muted-foreground">
                A semana abre na segunda-feira. Quando o acesso ocorre no domingo, mostramos a proxima semana util.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setWeekStart(getDoctorWeekStart(new Date()))}>
                Hoje
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
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
                          setBlockForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
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
                            setBlockForm((current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim</Label>
                        <Input
                          type="time"
                          value={blockForm.endTime}
                          onChange={(event) =>
                            setBlockForm((current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <p className="font-medium">
                  {format(weekStart, "d 'de' MMM", { locale: ptBR })} -{" "}
                  {format(addDays(weekStart, 6), "d 'de' MMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(weekStart, "MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <WeeklyCalendar
              days={weekDays}
              items={weeklyCalendarItems}
              selectedItemId={selectedCalendarItem?.id ?? null}
              onSelectItem={(item) => setSelectedCalendarItemId(item.id)}
              emptyLabel="Nenhum evento cadastrado para esta semana."
            />

            {selectedCalendarItem ? (
              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="font-semibold">{selectedCalendarItem.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(parseISO(selectedCalendarItem.startTime), "EEEE, d 'de' MMMM", {
                    locale: ptBR,
                  })}{" "}
                  • {formatTimeLabel(selectedCalendarItem.startTime)} -{" "}
                  {formatTimeLabel(selectedCalendarItem.endTime)}
                </p>
                {selectedCalendarItem.subtitle ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedCalendarItem.subtitle}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consultas de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsQuery.isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Carregando consultas...</div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const status = resolveAppointmentStatus(appointment.status);
                  const canComplete =
                    status === "Accepted" && new Date(appointment.startTime) <= new Date();

                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-col justify-between gap-4 rounded-lg bg-secondary/50 p-4 lg:flex-row lg:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <span className="font-medium text-primary">
                            {getInitials(getPatientName(appointment.patientId))}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{getPatientName(appointment.patientId)}</p>
                          <p className="text-sm text-muted-foreground">{appointment.title}</p>
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
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Nenhuma consulta registrada para hoje.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
