import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Lock,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api/clinix-api";
import { resolveScheduleVisibility } from "@/lib/api/domain";
import {
  WeeklyCalendarItem,
  buildAvailabilityPayloads,
  buildDoctorWeekDays,
  buildWeeklyCalendarItems,
  formatDaySelectionLabel,
  getDoctorWeekStart,
} from "@/lib/doctor-schedule";
import { formatDateTime, isPastDate } from "@/lib/date-utils";

export default function GestaoHorarios() {
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(getDoctorWeekStart(new Date()));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
    visibility: "Public" as "Public" | "Private",
  });

  const weekDays = useMemo(() => buildDoctorWeekDays(weekStart), [weekStart]);

  const availabilityQuery = useQuery({
    queryKey: ["appointments", "availability", profile?.userId, weekStart.toISOString()],
    queryFn: () =>
      appointmentsApi.getAvailability(session!.token, profile!.userId, {
        fromUtc: weekStart.toISOString(),
        toUtc: addDays(weekStart, 7).toISOString(),
      }),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const calendarQuery = useQuery({
    queryKey: ["appointments", "calendar", "horarios", profile?.userId, weekStart.toISOString()],
    queryFn: () =>
      appointmentsApi.getCalendar(session!.token, profile!.userId, {
        fromUtc: weekStart.toISOString(),
        toUtc: addDays(weekStart, 7).toISOString(),
      }),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const payloads = buildAvailabilityPayloads(
        selectedDates,
        formData.startTime,
        formData.endTime,
        formData.visibility,
      );

      for (const payload of payloads) {
        await appointmentsApi.createAvailability(session!.token, profile!.userId, payload);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "availability"] });
      setSelectedDates([]);
      setFormData({
        startTime: "",
        endTime: "",
        visibility: "Public",
      });
      toast({
        title: "Horarios adicionados",
        description: "As janelas selecionadas ja podem ser usadas no agendamento.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel salvar os horarios",
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

  const weeklyItems = useMemo(
    () => buildWeeklyCalendarItems(availabilityQuery.data ?? [], calendarQuery.data ?? []),
    [availabilityQuery.data, calendarQuery.data],
  );

  const selectedCalendarItem =
    weeklyItems.find((item) => item.id === selectedCalendarItemId) ??
    weeklyItems[0] ??
    null;

  function handleCreateAvailability() {
    if (selectedDates.length === 0 || !formData.startTime || !formData.endTime) {
      toast({
        title: "Campos obrigatorios",
        description: "Selecione pelo menos uma data, horario inicial e horario final.",
        variant: "destructive",
      });
      return;
    }

    if (formData.endTime <= formData.startTime) {
      toast({
        title: "Intervalo invalido",
        description: "O horario final precisa ser maior que o horario inicial.",
        variant: "destructive",
      });
      return;
    }

    createAvailabilityMutation.mutate();
  }

  function renderSelectedItemActions(item: WeeklyCalendarItem) {
    if (item.source !== "availability") {
      return null;
    }

    const visibility = availabilityQuery.data?.find((availability) => availability.id === item.referenceId)
      ?.visibility;
    const resolvedVisibility = resolveScheduleVisibility(visibility);

    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="status-badge bg-primary/10 text-primary">
          {resolvedVisibility === "Private" ? (
            <>
              <Lock className="mr-1 inline h-3.5 w-3.5" />
              Privada
            </>
          ) : (
            <>
              <Globe2 className="mr-1 inline h-3.5 w-3.5" />
              Publica
            </>
          )}
        </span>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteAvailabilityMutation.mutate(item.referenceId)}
          disabled={deleteAvailabilityMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remover disponibilidade
        </Button>
      </div>
    );
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestao de horarios disponiveis</h1>
          <p className="text-muted-foreground">
            Selecione varias datas de uma vez e acompanhe a semana em uma visao estilo calendario.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nova disponibilidade</CardTitle>
              <CardDescription>
                O backend trabalha com intervalos concretos de data e hora. Aqui voce pode repetir o mesmo horario em varias datas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Datas</Label>
                <div className="rounded-2xl border border-border bg-card">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates ?? [])}
                    disabled={(date) => isPastDate(date)}
                    className="mx-auto"
                  />
                </div>
              </div>

              {selectedDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDates
                    .slice()
                    .sort((left, right) => left.getTime() - right.getTime())
                    .map((date) => (
                      <span key={date.toISOString()} className="status-badge bg-secondary px-3 py-2 text-foreground">
                        {formatDaySelectionLabel(date)}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clique em varias datas para liberar o mesmo horario em todos esses dias.
                </p>
              )}

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
                <CalendarPlus className="mr-2 h-4 w-4" />
                {createAvailabilityMutation.isPending ? "Salvando..." : "Adicionar horarios"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da semana</CardTitle>
              <CardDescription>
                Veja os blocos disponiveis, as consultas agendadas e os bloqueios em uma visao unica.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Disponibilidades</p>
                <p className="text-2xl font-bold">{availabilityQuery.data?.length ?? 0}</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Consultas e eventos</p>
                <p className="text-2xl font-bold">{calendarQuery.data?.length ?? 0}</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Semana exibida</p>
                <p className="text-sm font-semibold">
                  {format(weekStart, "d/MM", { locale: ptBR })} - {format(addDays(weekStart, 6), "d/MM", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Calendario semanal</CardTitle>
              <CardDescription>
                Visao semanal semelhante a um calendario de agenda, com blocos por horario.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-48 text-center">
                <p className="font-medium">
                  {format(weekStart, "d 'de' MMMM", { locale: ptBR })} -{" "}
                  {format(addDays(weekStart, 6), "d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeeklyCalendar
              days={weekDays}
              items={weeklyItems}
              selectedItemId={selectedCalendarItem?.id ?? null}
              onSelectItem={(item) => setSelectedCalendarItemId(item.id)}
              emptyLabel="Nenhum horario ou evento encontrado nesta semana."
            />

            {selectedCalendarItem ? (
              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="font-semibold">{selectedCalendarItem.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(parseISO(selectedCalendarItem.startTime), "EEEE, d 'de' MMMM 'as' HH:mm")} -{" "}
                  {format(parseISO(selectedCalendarItem.endTime), "HH:mm", { locale: ptBR })}
                </p>
                {selectedCalendarItem.subtitle ? (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedCalendarItem.subtitle}</p>
                ) : null}
                {renderSelectedItemActions(selectedCalendarItem)}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
