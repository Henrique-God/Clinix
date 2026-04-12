import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/api/domain";
import { usersApi } from "@/lib/api/clinix-api";
import { cn } from "@/lib/utils";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Medico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmacao" },
];

export default function SelecionarMedico() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [selectedMedico, setSelectedMedico] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const especialidade = searchParams.get("especialidade") || "";

  const doctorsQuery = useQuery({
    queryKey: ["directory", "doctors", especialidade],
    queryFn: () =>
      usersApi.getDoctors(session!.token, {
        specialty: especialidade || undefined,
        limit: 100,
      }),
    enabled: Boolean(session?.token),
  });

  const filteredDoctors = useMemo(() => {
    const doctors = doctorsQuery.data ?? [];
    if (!searchTerm.trim()) {
      return doctors;
    }

    return doctors.filter((doctor) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      return (
        doctor.name.toLowerCase().includes(normalizedSearch) ||
        doctor.professionalRegister.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [doctorsQuery.data, searchTerm]);

  function handleNext() {
    if (!selectedMedico) {
      return;
    }

    navigate(
      `/agendar/data-hora?especialidade=${encodeURIComponent(especialidade)}&medico=${encodeURIComponent(selectedMedico)}`,
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={1} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <h1 className="text-2xl font-bold text-center mb-2">
            Escolha o medico
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {especialidade
              ? `Profissionais encontrados para ${especialidade}.`
              : "Selecione o profissional de sua preferencia."}
          </p>

          <div className="relative max-w-lg mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 input-focus"
              placeholder="Buscar por nome ou registro profissional..."
            />
          </div>

          <div className="space-y-4 mb-8 max-w-2xl mx-auto">
            {doctorsQuery.isLoading ? (
              <Card className="p-8 text-center bg-secondary/30 border-dashed">
                <p className="text-muted-foreground">Carregando medicos...</p>
              </Card>
            ) : doctorsQuery.isError ? (
              <Card className="p-8 text-center bg-destructive/5 border-destructive/20">
                <p className="text-sm text-muted-foreground">
                  Nao foi possivel carregar os profissionais agora.
                </p>
              </Card>
            ) : filteredDoctors.length > 0 ? (
              filteredDoctors.map((doctor) => {
                const isSelected = selectedMedico === doctor.userId;

                return (
                  <button
                    key={doctor.userId}
                    onClick={() => setSelectedMedico(doctor.userId)}
                    className={cn(
                      "specialty-card w-full flex items-center gap-4 p-4 text-left",
                      isSelected && "selected",
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {getInitials(doctor.name)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{doctor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {doctor.professionalRegister}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {doctor.specialties.join(", ")}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <Card className="p-8 text-center bg-secondary/30 border-dashed">
                <p className="font-medium mb-2">Nenhum medico encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Tente outra especialidade ou ajuste sua busca.
                </p>
              </Card>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!selectedMedico}>
              Proximo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
