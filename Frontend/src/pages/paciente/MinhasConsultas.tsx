import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, CheckCircle2, Clock, List, Plus, XCircle } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api/clinix-api";
import {
  Appointment,
  getAppointmentStatusLabel,
  resolveAppointmentParticipantRole,
  resolveAppointmentStatus,
} from "@/lib/api/domain";
import { formatDateLabel, formatDateTime, getAppointmentTimeRange } from "@/lib/date-utils";
import { loadDirectoryUsers } from "@/lib/directory";
import { cn } from "@/lib/utils";

function getStatusBadgeClass(status: string | null) {
  if (status === "Accepted") {
    return "status-badge status-scheduled";
  }

  if (status === "Completed") {
    return "status-badge status-completed";
  }

  if (status === "PendingAcceptance") {
    return "status-badge bg-warning/10 text-warning";
  }

  return "status-badge status-cancelled";
}

function groupAppointmentsByDay(appointments: Appointment[]) {
  return appointments.reduce<Record<string, Appointment[]>>((accumulator, appointment) => {
    const dateKey = appointment.startTime.slice(0, 10);
    const current = accumulator[dateKey] ?? [];
    accumulator[dateKey] = [...current, appointment];
    return accumulator;
  }, {});
}

export default function MinhasConsultas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "patient", "all"],
    queryFn: () => appointmentsApi.listPatientAppointments(session!.token),
    enabled: Boolean(session?.token),
  });

  const doctorsQuery = useQuery({
    queryKey: [
      "directory",
      "users",
      "patient-appointments",
      ...(appointmentsQuery.data ?? []).map((item) => item.doctorId).sort(),
    ],
    queryFn: () =>
      loadDirectoryUsers(
        session!.token,
        (appointmentsQuery.data ?? []).map((item) => item.doctorId),
      ),
    enabled: Boolean(session?.token && appointmentsQuery.data?.length),
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      action,
    }: {
      appointmentId: string;
      action: "accept" | "reject" | "cancel";
    }) => {
      if (action === "accept") {
        return appointmentsApi.acceptAppointment(session!.token, appointmentId);
      }

      if (action === "reject") {
        return appointmentsApi.rejectAppointment(session!.token, appointmentId);
      }

      return appointmentsApi.cancelAppointment(session!.token, appointmentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "patient"] });
      toast({
        title: "Consulta atualizada",
        description: "Os dados foram atualizados com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível atualizar a consulta",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const upcomingAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const status = resolveAppointmentStatus(appointment.status);
        return status === "PendingAcceptance" || status === "Accepted";
      }),
    [appointments],
  );

  const historyAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const status = resolveAppointmentStatus(appointment.status);
        return status !== "PendingAcceptance" && status !== "Accepted";
      }),
    [appointments],
  );

  const groupedUpcomingAppointments = useMemo(
    () => groupAppointmentsByDay(upcomingAppointments),
    [upcomingAppointments],
  );

  function getDoctorName(doctorId: string) {
    return doctorsQuery.data?.[doctorId]?.name ?? "Profissional";
  }

  function renderAppointmentCard(appointment: Appointment) {
    const status = resolveAppointmentStatus(appointment.status);
    const invitedByRole = resolveAppointmentParticipantRole(appointment.invitedByRole);
    const canAcceptOrReject = status === "PendingAcceptance" && invitedByRole === "Doctor";
    const canCancel = status === "PendingAcceptance" || status === "Accepted";

    return (
      <Card key={appointment.id} className="p-4 card-hover">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{appointment.title}</h3>
              <span className={getStatusBadgeClass(status)}>
                {getAppointmentStatusLabel(status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getDoctorName(appointment.doctorId)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(appointment.startTime)} • {getAppointmentTimeRange(appointment.startTime, appointment.endTime)}
            </p>
            {appointment.description ? (
              <p className="text-sm text-muted-foreground">{appointment.description}</p>
            ) : null}
          </div>

          {(canAcceptOrReject || canCancel) && (
            <div className="flex flex-wrap gap-2">
              {canAcceptOrReject ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      actionMutation.mutate({ appointmentId: appointment.id, action: "reject" })
                    }
                    disabled={actionMutation.isPending}
                  >
                    Recusar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      actionMutation.mutate({ appointmentId: appointment.id, action: "accept" })
                    }
                    disabled={actionMutation.isPending}
                  >
                    Aceitar
                  </Button>
                </>
              ) : null}

              {canCancel ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    actionMutation.mutate({ appointmentId: appointment.id, action: "cancel" })
                  }
                  disabled={actionMutation.isPending}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <PatientLayout>
      <div className="animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Minhas Consultas</h1>
            <p className="text-muted-foreground">Acompanhe convites, consultas confirmadas e histórico.</p>
          </div>

          <Button onClick={() => navigate("/agendar/especialidade")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Consulta
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
                <p className="text-xs text-muted-foreground">Próximas ou pendentes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {appointments.filter((appointment) => resolveAppointmentStatus(appointment.status) === "Completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Concluidas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {appointments.filter((appointment) => resolveAppointmentStatus(appointment.status) === "PendingAcceptance").length}
                </p>
                <p className="text-xs text-muted-foreground">Aguardando resposta</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end mb-4">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "list"
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {appointmentsQuery.isLoading ? (
          <Card className="p-10 text-center bg-secondary/30 border-dashed">
            <p className="text-muted-foreground">Carregando consultas...</p>
          </Card>
        ) : appointmentsQuery.isError ? (
          <Card className="p-10 text-center bg-destructive/5 border-destructive/20">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar suas consultas.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="proximas">
            <TabsList className="mb-4">
              <TabsTrigger value="proximas">Ativas</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="proximas">
              {upcomingAppointments.length > 0 ? (
                viewMode === "list" ? (
                  <div className="space-y-4">
                    {upcomingAppointments.map(renderAppointmentCard)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedUpcomingAppointments).map(([dateKey, dayAppointments]) => (
                      <Card key={dateKey} className="p-4">
                        <h3 className="font-medium mb-4">{formatDateLabel(`${dateKey}T00:00:00`)}</h3>
                        <div className="space-y-3">
                          {dayAppointments.map(renderAppointmentCard)}
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                <Card className="p-12 text-center">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Nenhuma consulta ativa</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Agende sua próxima consulta pela Clinix.
                  </p>
                  <Button onClick={() => navigate("/agendar/especialidade")}>
                    Agendar consulta
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="historico">
              {historyAppointments.length > 0 ? (
                <div className="space-y-4">
                  {historyAppointments.map(renderAppointmentCard)}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Nenhum histórico de consultas ainda.</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PatientLayout>
  );
}
