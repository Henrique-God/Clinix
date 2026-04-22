import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Baby,
  Bone,
  Brain,
  Eye,
  Heart,
  Search,
  Smile,
  Stethoscope,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api/clinix-api";
import { buildSpecialties } from "@/lib/directory";
import { cn } from "@/lib/utils";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

const specialtyIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Cardiologia: Heart,
  Dermatologia: Smile,
  Ortopedia: Bone,
  Pediatria: Baby,
  Ginecologia: Activity,
  Neurologia: Brain,
  Oftalmologia: Eye,
  "Clinica Geral": Stethoscope,
};

function getSpecialtyIcon(name: string) {
  return specialtyIcons[name] ?? Stethoscope;
}

export default function SelecionarEspecialidade() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const doctorsQuery = useQuery({
    queryKey: ["directory", "doctors", "all-specialties"],
    queryFn: () => usersApi.getDoctors(session!.token, { limit: 100 }),
    enabled: Boolean(session?.token),
  });

  const specialties = useMemo(() => {
    const allSpecialties = buildSpecialties(doctorsQuery.data ?? []);
    if (!searchTerm.trim()) {
      return allSpecialties;
    }

    return allSpecialties.filter((specialty) =>
      specialty.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
  }, [doctorsQuery.data, searchTerm]);

  function handleNext() {
    if (!selectedEspecialidade) {
      return;
    }

    navigate(`/agendar/medico?especialidade=${encodeURIComponent(selectedEspecialidade)}`);
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={0} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Selecione a especialidade
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Escolha a área médica para encontrar profissionais com horários públicos.
          </p>

          <div className="relative max-w-lg mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 input-focus"
              placeholder="Buscar especialidade..."
            />
          </div>

          {doctorsQuery.isLoading ? (
            <Card className="p-8 text-center bg-secondary/30 border-dashed">
              <p className="text-muted-foreground">Carregando especialidades...</p>
            </Card>
          ) : doctorsQuery.isError ? (
            <Card className="p-8 text-center bg-destructive/5 border-destructive/20">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar as especialidades disponíveis agora.
              </p>
            </Card>
          ) : specialties.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {specialties.map((specialty) => {
                const Icon = getSpecialtyIcon(specialty);
                const isSelected = selectedEspecialidade === specialty;

                return (
                  <button
                    key={specialty}
                    onClick={() => setSelectedEspecialidade(specialty)}
                    className={cn(
                      "specialty-card flex flex-col items-center gap-3 p-6",
                      isSelected && "selected",
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm text-center">{specialty}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Card className="p-10 text-center bg-secondary/30 border-dashed mb-8">
              <p className="font-medium mb-2">Nenhuma especialidade encontrada</p>
              <p className="text-sm text-muted-foreground">
                Tente outro termo de busca ou confira se existem médicos ativos cadastrados.
              </p>
            </Card>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/paciente/consultas")}>
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
