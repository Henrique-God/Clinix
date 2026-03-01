import { useState } from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const diasSemana = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

interface Horario {
  id: string;
  dia: string;
  inicio: string;
  fim: string;
}

export default function GestaoHorarios() {
  const { toast } = useToast();
  const [horarios, setHorarios] = useState<Horario[]>([
    { id: "1", dia: "Segunda-feira", inicio: "09:00", fim: "12:00" },
    { id: "2", dia: "Terça-feira", inicio: "14:00", fim: "18:00" },
  ]);

  const [novoHorario, setNovoHorario] = useState({
    dia: "",
    inicio: "",
    fim: "",
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddHorario = () => {
    if (!novoHorario.dia || !novoHorario.inicio || !novoHorario.fim) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const novo: Horario = {
      id: Date.now().toString(),
      ...novoHorario,
    };

    setHorarios([...horarios, novo]);
    setNovoHorario({ dia: "", inicio: "", fim: "" });
    setDialogOpen(false);

    toast({
      title: "Horário adicionado",
      description: `${novo.dia} das ${novo.inicio} às ${novo.fim}`,
    });
  };

  const handleDeleteHorario = (id: string) => {
    setHorarios(horarios.filter((h) => h.id !== id));
    toast({
      title: "Horário removido",
      description: "O horário foi removido com sucesso",
    });
  };

  return (
    <DoctorLayout>
      <div className="animate-slide-up max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Horários Disponíveis</h1>
            <p className="text-muted-foreground">
              Configure seus horários de atendimento
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Horário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Horário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Dia da semana</Label>
                  <Select
                    value={novoHorario.dia}
                    onValueChange={(value) =>
                      setNovoHorario({ ...novoHorario, dia: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {diasSemana.map((dia) => (
                        <SelectItem key={dia} value={dia}>
                          {dia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={novoHorario.inicio}
                      onChange={(e) =>
                        setNovoHorario({ ...novoHorario, inicio: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input
                      type="time"
                      value={novoHorario.fim}
                      onChange={(e) =>
                        setNovoHorario({ ...novoHorario, fim: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleAddHorario} className="w-full">
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Novo Horário</CardTitle>
              <CardDescription>
                Adicione um período de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select
                  value={novoHorario.dia}
                  onValueChange={(value) =>
                    setNovoHorario({ ...novoHorario, dia: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {diasSemana.map((dia) => (
                      <SelectItem key={dia} value={dia}>
                        {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário inicial</Label>
                  <Input
                    type="time"
                    value={novoHorario.inicio}
                    onChange={(e) =>
                      setNovoHorario({ ...novoHorario, inicio: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário final</Label>
                  <Input
                    type="time"
                    value={novoHorario.fim}
                    onChange={(e) =>
                      setNovoHorario({ ...novoHorario, fim: e.target.value })
                    }
                  />
                </div>
              </div>

              <Button onClick={handleAddHorario} className="w-full">
                Adicionar Horário
              </Button>
            </CardContent>
          </Card>

          {/* List Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Horários Configurados</CardTitle>
              <CardDescription>
                Seus períodos de atendimento atuais
              </CardDescription>
            </CardHeader>
            <CardContent>
              {horarios.length > 0 ? (
                <div className="space-y-3">
                  {horarios.map((horario) => (
                    <div
                      key={horario.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{horario.dia}</p>
                          <p className="text-sm text-muted-foreground">
                            {horario.inicio} - {horario.fim}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteHorario(horario.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum horário configurado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorLayout>
  );
}
