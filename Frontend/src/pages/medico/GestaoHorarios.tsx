import { useMemo, useState } from "react";
import { CalendarPlus, Clock, Globe2, Lock, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api/clinix-api";
import { resolveScheduleVisibility } from "@/lib/api/domain";
import { formatDateTime, getAppointmentTimeRange } from "@/lib/date-utils";

function buildIsoRange(date: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

export default function GestaoHorarios() {
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    visibility: "Public" as "Public" | "Private",
  });

  const availabilityQuery = useQuery({
    queryKey: ["appointments", "availability", profile?.userId],
    queryFn: () =>
      appointmentsApi.getAvailability(session!.token, profile!.userId, {
        fromUtc: new Date().toISOString(),
      }),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: () =>
      appointmentsApi.createAvailability(session!.token, profile!.userId, {
        startTime: buildIsoRange(formData.date, formData.startTime),
        endTime: buildIsoRange(formData.date, formData.endTime),
        visibility: formData.visibility,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "availability"] });
      setFormData({
        date: "",
        startTime: "",
        endTime: "",
        visibility: "Public",
      });
      toast({
        title: "Horario adicionado",
        description: "A nova janela de disponibilidade ja pode ser usada no agendamento.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel salvar o horario",
        description:
          error instanceof Error ? error.message : "Confira os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteAvailabilityMutation = useMutation({
    mutationFn: (availabilityId: string) =>
      appointmentsApi.deleteAvailability(session!.token, availabilityId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "availability"] });
      toast({
        title: "Horario removido",
        description: "A disponibilidade foi removida com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel remover o horario",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const upcomingAvailability = useMemo(
    () =>
      [...(availabilityQuery.data ?? [])].sort((left, right) =>
        left.startTime.localeCompare(right.startTime),
      ),
    [availabilityQuery.data],
  );

  function handleCreateAvailability() {
    if (!formData.date || !formData.startTime || !formData.endTime) {
      toast({
        title: "Campos obrigatorios",
        description: "Informe data, horario inicial e horario final.",
        variant: "destructive",
      });
      return;
    }

    createAvailabilityMutation.mutate();
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestao de horarios disponiveis</h1>
          <p className="text-muted-foreground">
            Configure janelas reais de atendimento com data, hora e visibilidade.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nova disponibilidade</CardTitle>
              <CardDescription>
                O backend trabalha com intervalos concretos de data e hora, sem recorrencia semanal automatica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inicio</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, startTime: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, endTime: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      visibility: value as "Public" | "Private",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Public">Publica</SelectItem>
                    <SelectItem value="Private">Privada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateAvailability}
                className="w-full"
                disabled={createAvailabilityMutation.isPending}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                {createAvailabilityMutation.isPending ? "Salvando..." : "Adicionar horario"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo rapido</CardTitle>
              <CardDescription>Visao geral das janelas futuras cadastradas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Total futuro</p>
                <p className="text-2xl font-bold">{upcomingAvailability.length}</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Publicas</p>
                <p className="text-2xl font-bold">
                  {upcomingAvailability.filter((item) => resolveScheduleVisibility(item.visibility) === "Public").length}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Privadas</p>
                <p className="text-2xl font-bold">
                  {upcomingAvailability.filter((item) => resolveScheduleVisibility(item.visibility) === "Private").length}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Proxima janela</p>
                <p className="text-sm font-semibold">
                  {upcomingAvailability[0]?.startTime
                    ? formatDateTime(upcomingAvailability[0].startTime, "d/MM 'as' HH:mm")
                    : "Nao definida"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Horarios configurados</CardTitle>
            <CardDescription>Janelas futuras registradas na AppointmentsAPI.</CardDescription>
          </CardHeader>
          <CardContent>
            {availabilityQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando horarios...</div>
            ) : availabilityQuery.isError ? (
              <div className="text-center py-8 text-muted-foreground">
                Nao foi possivel carregar suas disponibilidades.
              </div>
            ) : upcomingAvailability.length > 0 ? (
              <div className="space-y-3">
                {upcomingAvailability.map((availability) => {
                  const visibility = resolveScheduleVisibility(availability.visibility);

                  return (
                    <div
                      key={availability.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{formatDateTime(availability.startTime, "EEEE, d 'de' MMMM")}</p>
                          <p className="text-sm text-muted-foreground">
                            {getAppointmentTimeRange(availability.startTime, availability.endTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="status-badge bg-primary/10 text-primary flex items-center gap-1">
                          {visibility === "Public" ? (
                            <Globe2 className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          {visibility === "Public" ? "Publica" : "Privada"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAvailabilityMutation.mutate(availability.id)}
                          disabled={deleteAvailabilityMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum horario configurado para as proximas datas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
