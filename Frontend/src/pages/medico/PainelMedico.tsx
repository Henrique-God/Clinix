import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Appointment,
  Availability,
  getAppointmentStatusLabel,
  getInitials,
  resolveAppointmentParticipantRole,
  resolveAppointmentStatus,
} from "@/lib/api/domain";
import {
  WeeklyCalendarItem,
  buildDoctorWeekDays,
  buildIsoRangeForDate,
  buildWeeklyCalendarItems,
  getDoctorWeekStart,
} from "@/lib/doctor-schedule";
import { formatDateTime, formatTimeLabel } from "@/lib/date-utils";
import { loadDirectoryUsers } from "@/lib/directory";

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}

function isAppointmentCoveredByAvailability(appointment: Appointment, availabilities: Availability[]) {
  return availabilities.some((availability) => {
    return (
      availability.startTime <= appointment.startTime &&
      availability.endTime >= appointment.endTime
    );
  });
}

function hasCalendarConflict(appointment: Appointment, calendarItems: WeeklyCalendarItem[]) {
  return calendarItems.some((item) => {
    if (item.source !== "calendar-event") {
      return false;
    }

    if (item.appointmentId === appointment.id) {
      return false;
    }

    if (item.variant === "appointment-completed") {
      return false;
    }

    return overlaps(
      appointment.startTime,
      appointment.endTime,
      item.startTime,
      item.endTime,
    );
  });
}

export default function PainelMedico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(getDoctorWeekStart(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string | null>(null);
  const [appointmentDialogItemId, setAppointmentDialogItemId] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({
    title: "HorÃ¡rio bloqueado",
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

  const availabilityQuery = useQuery({
    queryKey: ["appointments", "availability", "dashboard", profile?.userId, weekStart.toISOString()],
    queryFn: () =>
      appointmentsApi.getAvailability(session!.token, profile!.userId, {
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
        title: "HorÃ¡rio bloqueado",
        description: "",
        date: format(weekStart, "yyyy-MM-dd"),
        startTime: "",
        endTime: "",
      });
      toast({
        title: "Bloqueio criado",
        description: "O perÃ­odo foi reservado na agenda do mÃ©dico.",
      });
    },
    onError: (error) => {
      toast({
        title: "NÃ£o foi possÃ­vel bloquear o horÃ¡rio",
        description:
          error instanceof Error ? error.message : "Confira os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const respondInviteMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      action,
    }: {
      appointmentId: string;
      action: "accept" | "reject";
    }) => {
      if (action === "accept") {
        return appointmentsApi.acceptAppointment(session!.token, appointmentId);
      }

      return appointmentsApi.rejectAppointment(session!.token, appointmentId);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "doctor"] });
      await queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
      toast({
        title: variables.action === "accept" ? "Convite aceito" : "Convite recusado",
        description: "A agenda foi sincronizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "NÃ£o foi possÃ­vel responder ao convite",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
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
        title: "Consulta concluÃ­da",
        description: "A consulta foi marcada como concluÃ­da e a integraÃ§Ã£o clÃ­nica foi acionada.",
      });
    },
    onError: (error) => {
      toast({
        title: "NÃ£o foi possÃ­vel concluir a consulta",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const availabilities = useMemo(() => availabilityQuery.data ?? [], [availabilityQuery.data]);
  const weeklyCalendarItems = useMemo(
    () => buildWeeklyCalendarItems(availabilities, calendarQuery.data ?? []),
    [availabilities, calendarQuery.data],
  );

  const pendingInvites = useMemo(
    () =>
      appointments
        .filter((appointment) => {
          return (
            resolveAppointmentStatus(appointment.status) === "PendingAcceptance" &&
            resolveAppointmentParticipantRole(appointment.invitedByRole) === "Patient"
          );
        })
        .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [appointments],
  );

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

  const selectedCalendarItem =
    weeklyCalendarItems.find((item) => item.id === selectedCalendarItemId) ??
    weeklyCalendarItems[0] ??
    null;

  const selectedPendingInvite =
    pendingInvites.find((appointment) => appointment.id === selectedCalendarItem?.appointmentId) ??
    null;
  const selectedAppointmentForDialog =
    appointments.find((appointment) => appointment.id === appointmentDialogItemId) ?? null;

  const uniquePatientsCount = new Set(appointments.map((appointment) => appointment.patientId)).size;

  function getPatientName(patientId: string) {
    return directoryUsersQuery.data?.[patientId]?.name ?? "Paciente";
  }

  function focusAppointmentInCalendar(appointment: Appointment) {
    const appointmentDate = parseISO(appointment.startTime);
    setWeekStart(getDoctorWeekStart(appointmentDate));
    setFocusedAppointmentId(appointment.id);
  }

  useEffect(() => {
    if (!focusedAppointmentId) {
      return;
    }

    const matchingItem = weeklyCalendarItems.find((item) => item.appointmentId === focusedAppointmentId);
    if (!matchingItem) {
      return;
    }

    setSelectedCalendarItemId(matchingItem.id);
    setFocusedAppointmentId(null);
  }, [focusedAppointmentId, weeklyCalendarItems]);

  function handleCreateBlockedSlot() {
    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime || !blockForm.title.trim()) {
      toast({
        title: "Campos obrigatÃ³rios",
        description: "Informe data, horÃ¡rio inicial, final e tÃ­tulo do bloqueio.",
        variant: "destructive",
      });
      return;
    }

    createBlockedSlotMutation.mutate();
  }

  function handleSelectCalendarItem(item: WeeklyCalendarItem) {
    setSelectedCalendarItemId(item.id);

    if (item.appointmentId) {
      setAppointmentDialogItemId(item.appointmentId);
    }
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        <div>
          <h1 className="text-2xl font-bold">OlÃ¡, {profile?.name ?? "mÃ©dico"}</h1>
          <p className="text-muted-foreground">Resumo da sua agenda Clinix, convites pendentes e consultas do dia.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
                <div className="rounded-xl bg-warning/10 p-3">
                  <Calendar className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{pendingInvites.length}</p>
                  <p className="text-sm text-muted-foreground">Pendentes de aceite</p>
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
                  <p className="text-sm text-muted-foreground">Blocos na semana</p>
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
                  <p className="text-sm text-muted-foreground">Pacientes na agenda</p>
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
                Convites pendentes aparecem em destaque para facilitar a decisÃ£o. Disponibilidades ficam em verde e consultas confirmadas em azul.
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
                    Bloquear horÃ¡rio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo bloqueio de agenda</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>TÃ­tulo</Label>
                      <Input
                        value={blockForm.title}
                        onChange={(event) =>
                          setBlockForm((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>DescriÃ§Ã£o</Label>
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
                        <Label>InÃ­cio</Label>
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
              onSelectItem={handleSelectCalendarItem}
              emptyLabel="Nenhum evento cadastrado para esta semana."
            />

            {selectedCalendarItem ? (
              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="font-semibold">{selectedCalendarItem.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(parseISO(selectedCalendarItem.startTime), "EEEE, d 'de' MMMM", {
                    locale: ptBR,
                  })}{" "}
                  â€¢ {formatTimeLabel(selectedCalendarItem.startTime)} -{" "}
                  {formatTimeLabel(selectedCalendarItem.endTime)}
                </p>
                {selectedCalendarItem.subtitle ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedCalendarItem.subtitle}
                  </p>
                ) : null}

                {selectedPendingInvite ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        respondInviteMutation.mutate({
                          appointmentId: selectedPendingInvite.id,
                          action: "accept",
                        })
                      }
                      disabled={respondInviteMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Aceitar convite
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        respondInviteMutation.mutate({
                          appointmentId: selectedPendingInvite.id,
                          action: "reject",
                        })
                      }
                      disabled={respondInviteMutation.isPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Recusar convite
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingInvites.length > 0 ? (
              <div className="space-y-3">
                {pendingInvites.map((appointment) => {
                  const coveredByAvailability = isAppointmentCoveredByAvailability(
                    appointment,
                    availabilities,
                  );
                  const conflictWithAgenda = hasCalendarConflict(
                    appointment,
                    weeklyCalendarItems,
                  );

                  return (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{appointment.title}</p>
                            <span className="status-badge bg-warning/10 text-warning">
                              Aguardando sua resposta
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Paciente: {getPatientName(appointment.patientId)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(appointment.startTime), "EEEE, d 'de' MMMM", {
                              locale: ptBR,
                            })}{" "}
                            â€¢ {formatTimeLabel(appointment.startTime)} - {formatTimeLabel(appointment.endTime)}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="status-badge bg-secondary text-foreground">
                              {coveredByAvailability
                                ? "Dentro da disponibilidade"
                                : "Fora da disponibilidade atual"}
                            </span>
                            <span className="status-badge bg-secondary text-foreground">
                              {conflictWithAgenda
                                ? "Conflito com outro bloco"
                                : "Sem conflito adicional"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => focusAppointmentInCalendar(appointment)}>
                            Ver no calendario
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              respondInviteMutation.mutate({
                                appointmentId: appointment.id,
                                action: "reject",
                              })
                            }
                            disabled={respondInviteMutation.isPending}
                          >
                            Recusar
                          </Button>
                          <Button
                            onClick={() =>
                              respondInviteMutation.mutate({
                                appointmentId: appointment.id,
                                action: "accept",
                              })
                            }
                            disabled={respondInviteMutation.isPending}
                          >
                            Aceitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum convite pendente de aceite no momento.
              </div>
            )}
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
                            {formatTimeLabel(appointment.startTime)} â€¢ {getAppointmentStatusLabel(status)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/medico/prontuario/${appointment.patientId}`)}
                        >
                          Ver prontuário
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

        <Dialog
          open={Boolean(selectedAppointmentForDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setAppointmentDialogItemId(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedAppointmentForDialog?.title ?? "Detalhes da consulta"}</DialogTitle>
              <DialogDescription>
                Confira as informaÃ§Ãµes principais desta consulta e acesse o prontuÃ¡rio do paciente.
              </DialogDescription>
            </DialogHeader>

            {selectedAppointmentForDialog ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Paciente</p>
                  <p className="mt-1 font-medium">
                    {getPatientName(selectedAppointmentForDialog.patientId)}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Data e horÃ¡rio</p>
                    <p className="mt-1 font-medium">
                      {formatDateTime(selectedAppointmentForDialog.startTime)} â€¢{" "}
                      {formatTimeLabel(selectedAppointmentForDialog.endTime)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-1 font-medium">
                      {getAppointmentStatusLabel(
                        resolveAppointmentStatus(selectedAppointmentForDialog.status),
                      )}
                    </p>
                  </div>
                </div>

                {selectedAppointmentForDialog.location ? (
                  <div className="rounded-xl bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Local</p>
                    <p className="mt-1 font-medium">{selectedAppointmentForDialog.location}</p>
                  </div>
                ) : null}

                {selectedAppointmentForDialog.description ? (
                  <div className="rounded-xl bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">ObservaÃ§Ãµes</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedAppointmentForDialog.description}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAppointmentDialogItemId(null);
                      navigate(`/medico/prontuario/${selectedAppointmentForDialog.patientId}`);
                    }}
                  >
                    Ir para o prontuÃ¡rio
                  </Button>
                  {resolveAppointmentStatus(selectedAppointmentForDialog.status) === "PendingAcceptance" ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          respondInviteMutation.mutate({
                            appointmentId: selectedAppointmentForDialog.id,
                            action: "reject",
                          })
                        }
                        disabled={respondInviteMutation.isPending}
                      >
                        Recusar
                      </Button>
                      <Button
                        onClick={() =>
                          respondInviteMutation.mutate({
                            appointmentId: selectedAppointmentForDialog.id,
                            action: "accept",
                          })
                        }
                        disabled={respondInviteMutation.isPending}
                      >
                        Aceitar
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
}
