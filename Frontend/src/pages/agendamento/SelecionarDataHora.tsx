import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentsApi } from "@/lib/api/clinix-api";
import { formatTimeLabel } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Medico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmacao" },
];

export default function SelecionarDataHora() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const especialidade = searchParams.get("especialidade") || "";
  const medico = searchParams.get("medico") || "";

  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const availableSlotsQuery = useQuery({
    queryKey: ["appointments", "available-slots", medico, weekStart.toISOString()],
    queryFn: () =>
      appointmentsApi.getAvailableSlots(session!.token, medico, {
        fromUtc: weekStart.toISOString(),
        toUtc: addDays(weekStart, 7).toISOString(),
        durationMinutes: 30,
    }),
    enabled: Boolean(session?.token && medico),
  });
  const availableSlots = useMemo(
    () => availableSlotsQuery.data ?? [],
    [availableSlotsQuery.data],
  );

  const slotsByDate = useMemo(() => {
    const groups = new Map<string, typeof availableSlots>();

    availableSlots.forEach((slot) => {
      const dateKey = format(parseISO(slot.startTime), "yyyy-MM-dd");
      const currentGroup = groups.get(dateKey) ?? [];
      groups.set(dateKey, [...currentGroup, slot]);
    });

    return groups;
  }, [availableSlots]);

  const selectedDateSlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];
  const selectedSlot =
    selectedSlotStart
      ? selectedDateSlots.find((slot) => slot.startTime === selectedSlotStart) ?? null
      : null;

  useEffect(() => {
    if (!availableSlots.length) {
      setSelectedDate(null);
      setSelectedSlotStart(null);
      return;
    }

    const firstAvailableDate = format(
      parseISO(availableSlots[0].startTime),
      "yyyy-MM-dd",
    );

    setSelectedDate((current) => (current && slotsByDate.has(current) ? current : firstAvailableDate));
    setSelectedSlotStart(null);
  }, [availableSlots, slotsByDate]);

  function handleNext() {
    if (!selectedSlot) {
      return;
    }

    navigate(
      `/agendar/confirmacao?especialidade=${encodeURIComponent(especialidade)}&medico=${encodeURIComponent(
        medico,
      )}&inicio=${encodeURIComponent(selectedSlot.startTime)}&fim=${encodeURIComponent(selectedSlot.endTime)}`,
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={2} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Selecione data e horario
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Escolha um horario publico disponivel para enviar o convite de consulta.
          </p>

          <div className="flex items-center justify-between mb-6">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">
            {weekDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const hasSlots = slotsByDate.has(dateKey);
              const isSelected = selectedDate === dateKey;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => hasSlots && setSelectedDate(dateKey)}
                  disabled={!hasSlots}
                  className={cn(
                    "p-3 rounded-lg text-center transition-all border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary",
                    !hasSlots && "opacity-50 cursor-not-allowed bg-muted",
                  )}
                >
                  <div className="text-xs uppercase mb-1">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className="text-lg font-semibold">{format(day, "d")}</div>
                  <div className="text-xs mt-1">
                    {hasSlots ? `${slotsByDate.get(dateKey)?.length ?? 0} horarios` : "Sem vagas"}
                  </div>
                </button>
              );
            })}
          </div>

          {availableSlotsQuery.isLoading ? (
            <Card className="p-8 text-center bg-secondary/30 border-dashed mb-8">
              <p className="text-muted-foreground">Carregando horarios...</p>
            </Card>
          ) : availableSlotsQuery.isError ? (
            <Card className="p-8 text-center bg-destructive/5 border-destructive/20 mb-8">
              <p className="text-sm text-muted-foreground">
                Nao foi possivel carregar os horarios disponiveis.
              </p>
            </Card>
          ) : selectedDateSlots.length > 0 && selectedDate ? (
            <div className="mb-8 animate-fade-in">
              <h3 className="font-medium mb-4 text-center">
                Horarios para{" "}
                {format(parseISO(`${selectedDate}T00:00:00`), "EEEE, d 'de' MMMM", {
                  locale: ptBR,
                })}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {selectedDateSlots.map((slot) => {
                  const isSelected = selectedSlotStart === slot.startTime;

                  return (
                    <button
                      key={slot.startTime}
                      onClick={() => setSelectedSlotStart(slot.startTime)}
                      className={cn("time-slot", isSelected && "selected")}
                    >
                      {formatTimeLabel(slot.startTime)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center bg-secondary/30 border-dashed mb-8">
              <p className="font-medium mb-2">Nenhum horario publico nesta semana</p>
              <p className="text-sm text-muted-foreground">
                Avance para outra semana ou escolha outro profissional.
              </p>
            </Card>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!selectedSlot}>
              Proximo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
