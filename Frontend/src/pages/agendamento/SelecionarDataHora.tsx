import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

const horarios = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

export default function SelecionarDataHora() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const especialidade = searchParams.get("especialidade") || "";
  const medico = searchParams.get("medico") || "";

  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePrevWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const handleNext = () => {
    if (selectedDate && selectedHorario) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      navigate(
        `/agendar/confirmacao?especialidade=${especialidade}&medico=${medico}&data=${dateStr}&horario=${selectedHorario}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={2} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Selecione Data e Horário
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Escolha o melhor dia e horário para sua consulta
          </p>

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-medium">
              {format(weekStart, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-2 mb-8">
            {weekDays.map((day) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => !isPast && !isWeekend && setSelectedDate(day)}
                  disabled={isPast || isWeekend}
                  className={cn(
                    "p-3 rounded-lg text-center transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:border-primary",
                    (isPast || isWeekend) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="text-xs uppercase mb-1">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className="text-lg font-semibold">
                    {format(day, "d")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div className="mb-8 animate-fade-in">
              <h3 className="font-medium mb-4 text-center">
                Horários disponíveis para{" "}
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {horarios.map((horario) => {
                  const isSelected = selectedHorario === horario;

                  return (
                    <button
                      key={horario}
                      onClick={() => setSelectedHorario(horario)}
                      className={cn("time-slot", isSelected && "selected")}
                    >
                      {horario}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button
              onClick={handleNext}
              disabled={!selectedDate || !selectedHorario}
            >
              Próximo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
