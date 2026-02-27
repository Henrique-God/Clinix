import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Stethoscope, Brain, Eye, Baby, Bone, Smile, Activity } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const especialidades = [
  { id: "cardiologia", nome: "Cardiologia", icon: Heart },
  { id: "dermatologia", nome: "Dermatologia", icon: Smile },
  { id: "ortopedia", nome: "Ortopedia", icon: Bone },
  { id: "pediatria", nome: "Pediatria", icon: Baby },
  { id: "ginecologia", nome: "Ginecologia", icon: Activity },
  { id: "neurologia", nome: "Neurologia", icon: Brain },
  { id: "oftalmologia", nome: "Oftalmologia", icon: Eye },
  { id: "clinica-geral", nome: "Clínica Geral", icon: Stethoscope },
];

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

export default function SelecionarEspecialidade() {
  const navigate = useNavigate();
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedEspecialidade) {
      navigate(`/agendar/medico?especialidade=${selectedEspecialidade}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={0} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Selecione a Especialidade
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Qual especialidade você precisa?
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {especialidades.map((esp) => {
              const Icon = esp.icon;
              const isSelected = selectedEspecialidade === esp.id;

              return (
                <button
                  key={esp.id}
                  onClick={() => setSelectedEspecialidade(esp.id)}
                  className={cn(
                    "specialty-card flex flex-col items-center gap-3 p-6",
                    isSelected && "selected"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-sm text-center">
                    {esp.nome}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate("/paciente/consultas")}
            >
              Cancelar
            </Button>
            <Button onClick={handleNext} disabled={!selectedEspecialidade}>
              Próximo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
