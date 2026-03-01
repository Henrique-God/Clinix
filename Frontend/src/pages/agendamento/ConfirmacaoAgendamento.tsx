import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Calendar, Clock, User, Stethoscope, AlertCircle } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

const especialidadesNome: Record<string, string> = {
  cardiologia: "Cardiologia",
  dermatologia: "Dermatologia",
  ortopedia: "Ortopedia",
  pediatria: "Pediatria",
  ginecologia: "Ginecologia",
  neurologia: "Neurologia",
  oftalmologia: "Oftalmologia",
  "clinica-geral": "Clínica Geral",
};

const medicosNome: Record<string, string> = {
  "dr-joao": "Dr. João Silva",
  "dra-maria": "Dra. Maria Santos",
  "dr-pedro": "Dr. Pedro Costa",
  "dra-ana": "Dra. Ana Lima",
};

export default function ConfirmacaoAgendamento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const especialidade = searchParams.get("especialidade") || "";
  const medico = searchParams.get("medico") || "";
  const data = searchParams.get("data") || "";
  const horario = searchParams.get("horario") || "";

  const dataFormatada = data
    ? format(parseISO(data), "EEEE, d 'de' MMMM", { locale: ptBR })
    : "";

  const handleConfirmar = () => {
    toast({
      title: "Consulta agendada com sucesso!",
      description: "Você receberá um lembrete por e-mail.",
    });
    navigate("/paciente/consultas");
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={3} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Confirmação</h1>
          <p className="text-muted-foreground text-center mb-8">
            Revise os detalhes da sua consulta
          </p>

          <div className="bg-secondary/30 rounded-xl p-6 mb-6 max-w-md mx-auto">
            <h2 className="font-semibold mb-4 text-lg">Resumo da Consulta</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Especialidade:</p>
                  <p className="font-medium">
                    {especialidadesNome[especialidade] || especialidade}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Médico:</p>
                  <p className="font-medium">
                    {medicosNome[medico] || medico}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Data:</p>
                  <p className="font-medium capitalize">{dataFormatada}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Horário:</p>
                  <p className="font-medium">{horario}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-8 max-w-md mx-auto flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Lembre-se de chegar com 15 minutos de antecedência ou acessar o
              link da teleconsulta no horário marcado
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button onClick={handleConfirmar}>
              Confirmar Agendamento
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
