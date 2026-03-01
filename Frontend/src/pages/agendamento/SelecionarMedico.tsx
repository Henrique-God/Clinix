import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const medicos = [
  {
    id: "dr-joao",
    nome: "Dr. João Silva",
    especialidade: "cardiologia",
    crm: "CRM 12345",
  },
  {
    id: "dra-maria",
    nome: "Dra. Maria Santos",
    especialidade: "cardiologia",
    crm: "CRM 54321",
  },
  {
    id: "dr-pedro",
    nome: "Dr. Pedro Costa",
    especialidade: "dermatologia",
    crm: "CRM 11111",
  },
  {
    id: "dra-ana",
    nome: "Dra. Ana Lima",
    especialidade: "ortopedia",
    crm: "CRM 22222",
  },
];

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

export default function SelecionarMedico() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const especialidade = searchParams.get("especialidade") || "";
  const [selectedMedico, setSelectedMedico] = useState<string | null>(null);

  const medicosFiltrados = medicos.filter(
    (m) => m.especialidade === especialidade || !especialidade
  );

  const handleNext = () => {
    if (selectedMedico) {
      navigate(
        `/agendar/data-hora?especialidade=${especialidade}&medico=${selectedMedico}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={1} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Escolha o Médico
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Selecione o profissional de sua preferência
          </p>

          <div className="space-y-4 mb-8 max-w-md mx-auto">
            {medicosFiltrados.length > 0 ? (
              medicosFiltrados.map((medico) => {
                const isSelected = selectedMedico === medico.id;

                return (
                  <button
                    key={medico.id}
                    onClick={() => setSelectedMedico(medico.id)}
                    className={cn(
                      "specialty-card w-full flex items-center gap-4 p-4 text-left",
                      isSelected && "selected"
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {medico.nome.split(" ")[1]?.[0] || medico.nome[0]}
                    </div>
                    <div>
                      <p className="font-medium">{medico.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {medico.crm}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum médico disponível para esta especialidade
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!selectedMedico}>
              Próximo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
