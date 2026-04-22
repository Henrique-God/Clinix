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
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Badge } from "@/components/ui/badge";
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
import { HEALTH_INSURANCE_PLANS } from "@/lib/health-insurance-plans";
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
    acceptsPrivate: true,
    acceptsInsurance: false,
  });
  const [slotInsurancePlans, setSlotInsurancePlans] = useState<string[]>([]);

  const doctorAcceptedPlans = useMemo(
    () => profile?.acceptedInsurancePlans ?? [],
    [profile],
  );
  const availablePlansForSlot = useMemo(
    () =>
      doctorAcceptedPlans.length > 0
        ? doctorAcceptedPlans
        : (HEALTH_INSURANCE_PLANS as unknown as string[]),
    [doctorAcceptedPlans],
  );

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
        {
          acceptsPrivate: formData.acceptsPrivate,
          acceptsInsurance: formData.acceptsInsurance,
          insurancePlans: formData.acceptsInsurance ? slotInsurancePlans : undefined,
        },
      );

      for (const payload of payloads) {
        await appointmentsApi.createAvailability(session!.token, profile!.userId, payload);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "availability"] });
      setSelectedDates([]);
      setSlotInsurancePlans([]);
      setFormData({
        startTime: "",
        endTime: "",
        visibility: "Public",
        acceptsPrivate: true,
        acceptsInsurance: false,
      });
      toast({
        title: "Horários adicionados",
        description: "As janelas selecionadas já podem ser usadas no agendamento.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível salvar os horários",
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
        title: "Horário removido",
        description: "A disponibilidade foi removida com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível remover o horário",
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
        title: "Campos obrigatórios",
        description: "Selecione pelo menos uma data, horário inicial e horário final.",
        variant: "destructive",
      });
      return;
    }

    if (formData.endTime <= formData.startTime) {
      toast({
        title: "Intervalo inválido",
        description: "O horário final precisa ser maior que o horário inicial.",
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
              Pública
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
          <h1 className="text-2xl font-bold">Gestão de horários disponíveis</h1>
          <p className="text-muted-foreground">
            Selecione várias datas de uma vez e acompanhe a semana em uma visão estilo calendário.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nova disponibilidade</CardTitle>
              <CardDescription>
                Cadastre períodos específicos de atendimento e repita o mesmo horário em várias datas quando precisar.
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
                  Clique em várias datas para liberar o mesmo horário em todos esses dias.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
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
                    <SelectItem value="Public">Pública</SelectItem>
                    <SelectItem value="Private">Privada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <Label className="text-sm font-medium">Tipo de consulta aceita</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.acceptsPrivate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, acceptsPrivate: e.target.checked }))
                      }
                      className="rounded border-input"
                    />
                    Particular
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.acceptsInsurance}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, acceptsInsurance: e.target.checked }));
                        if (!e.target.checked) setSlotInsurancePlans([]);
                      }}
                      className="rounded border-input"
                    />
                    Plano de saúde
                  </label>
                </div>

                {formData.acceptsInsurance && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Planos aceitos neste horário</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (!slotInsurancePlans.includes(value)) {
                          setSlotInsurancePlans((prev) => [...prev, value]);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Adicionar plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlansForSlot
                          .filter((plan) => !slotInsurancePlans.includes(plan))
                          .map((plan) => (
                            <SelectItem key={plan} value={plan}>
                              {plan}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {slotInsurancePlans.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {slotInsurancePlans.map((plan) => (
                          <Badge key={plan} variant="secondary" className="gap-1 pr-1 text-xs">
                            {plan}
                            <button
                              type="button"
                              onClick={() =>
                                setSlotInsurancePlans((prev) => prev.filter((p) => p !== plan))
                              }
                              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateAvailability}
                className="w-full"
                disabled={createAvailabilityMutation.isPending}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                {createAvailabilityMutation.isPending ? "Salvando..." : "Adicionar horários"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da semana</CardTitle>
              <CardDescription>
                Veja os blocos disponíveis, as consultas agendadas e os bloqueios em uma visão única.
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
                Visão semanal semelhante a um calendário de agenda, com blocos por horário.
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
