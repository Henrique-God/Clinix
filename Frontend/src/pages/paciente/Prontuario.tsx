import { useState } from "react";
import { FileText, Pill, TestTube, Calendar, ChevronDown, ChevronUp, Download } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Mock data
const paciente = {
  nome: "Ana Paula Costa",
  cpf: "123.456.789-00",
  convenio: "Unimed",
  idade: "35 anos",
};

const historico = [
  {
    id: "1",
    data: "15 de janeiro de 2026",
    tipo: "Consulta - Cardiologia",
    medico: "Dr. João Silva",
    observacoes:
      "Paciente apresentou melhora nos níveis de pressão arterial. Retorno em 30 dias.",
    diagnostico: "Hipertensão arterial leve",
    medicamentos: [
      "Losartana 50mg - 1x ao dia",
      "Hidroclorotiazida 25mg - 1x ao dia",
    ],
  },
];

const receitas = [
  {
    id: "1",
    data: "15 de janeiro de 2026",
    medico: "Dr. João Silva",
    medicamentos: ["Losartana 50mg", "Hidroclorotiazida 25mg"],
  },
];

const exames = [
  {
    id: "1",
    data: "10 de janeiro de 2026",
    tipo: "Eletrocardiograma",
    status: "Disponível",
  },
  {
    id: "2",
    data: "10 de janeiro de 2026",
    tipo: "Hemograma Completo",
    status: "Disponível",
  },
];

export default function Prontuario() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <PatientLayout>
      <div className="animate-slide-up">
        {/* Patient Info Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">AP</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">{paciente.nome}</h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>CPF: {paciente.cpf}</span>
                    <span>Convênio: {paciente.convenio}</span>
                    <span>Idade: {paciente.idade}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Baixar Prontuário
              </Button>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold mb-4">Prontuário Clínico</h2>

        <Tabs defaultValue="historico">
          <TabsList className="mb-4">
            <TabsTrigger value="historico" className="gap-2">
              <FileText className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="receitas" className="gap-2">
              <Pill className="w-4 h-4" />
              Receitas
            </TabsTrigger>
            <TabsTrigger value="exames" className="gap-2">
              <TestTube className="w-4 h-4" />
              Exames
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            <div className="space-y-4">
              {historico.map((item) => {
                const isExpanded = expandedItem === item.id;

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedItem(isExpanded ? null : item.id)
                      }
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{item.tipo}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.data} • {item.medico}
                          </p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300",
                        isExpanded ? "max-h-96" : "max-h-0"
                      )}
                    >
                      <div className="p-4 pt-0 border-t border-border">
                        <div className="grid gap-4 sm:grid-cols-2 mt-4">
                          <div>
                            <h4 className="font-medium text-sm mb-2">
                              Diagnóstico
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {item.diagnostico}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm mb-2">
                              Medicamentos Prescritos
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {item.medicamentos.map((med, idx) => (
                                <li key={idx}>• {med}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-4">
                          <h4 className="font-medium text-sm mb-2">
                            Observações
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.observacoes}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="receitas">
            <div className="space-y-4">
              {receitas.map((receita) => (
                <Card key={receita.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <Pill className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          Receita - {receita.data}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {receita.medico}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {receita.medicamentos.join(", ")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="exames">
            <div className="space-y-4">
              {exames.map((exame) => (
                <Card key={exame.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <TestTube className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <h3 className="font-medium">{exame.tipo}</h3>
                        <p className="text-sm text-muted-foreground">
                          {exame.data}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="status-badge status-completed">
                        {exame.status}
                      </span>
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
}
