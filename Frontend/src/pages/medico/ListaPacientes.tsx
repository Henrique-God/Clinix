import { useState } from "react";
import { Search, User, FileText, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const pacientes = [
  {
    id: "1",
    nome: "Ana Paula Costa",
    cpf: "123.456.789-00",
    ultimaConsulta: "15/01/2026",
    convenio: "Unimed",
  },
  {
    id: "2",
    nome: "Carlos Silva",
    cpf: "987.654.321-00",
    ultimaConsulta: "10/01/2026",
    convenio: "Bradesco Saúde",
  },
  {
    id: "3",
    nome: "Maria Santos",
    cpf: "456.789.123-00",
    ultimaConsulta: "05/01/2026",
    convenio: "SUS",
  },
];

export default function ListaPacientes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cpf.includes(searchTerm)
  );

  return (
    <DoctorLayout>
      <div className="animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pacientes</h1>
            <p className="text-muted-foreground">
              Lista de todos os seus pacientes
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          {pacientesFiltrados.map((paciente) => (
            <Card key={paciente.id} className="p-4 card-hover">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-medium text-primary">
                      {paciente.nome.split(" ")[0][0]}
                      {paciente.nome.split(" ")[1]?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">{paciente.nome}</h3>
                    <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                      <span>CPF: {paciente.cpf}</span>
                      <span>Convênio: {paciente.convenio}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">Última consulta:</span>
                    {paciente.ultimaConsulta}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/medico/prontuario/${paciente.id}`)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Prontuário
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {pacientesFiltrados.length === 0 && (
            <Card className="p-12 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Nenhum paciente encontrado
              </p>
            </Card>
          )}
        </div>
      </div>
    </DoctorLayout>
  );
}
