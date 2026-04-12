import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { workoutRoutinesApi } from "@/lib/api/clinix-api";
import { getDayOfWeekLabel, WorkoutRoutine } from "@/lib/api/domain";

export default function RotinaTreinos() {
  return (
    <PatientLayout>
      <PremiumFeatureGate featureName="rotinas de treino">
        <RoutinesList />
      </PremiumFeatureGate>
    </PatientLayout>
  );
}

function RoutinesList() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");

  const routinesQuery = useQuery({
    queryKey: ["workout-routines"],
    queryFn: () => workoutRoutinesApi.list(session!.token),
    enabled: Boolean(session?.token),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      workoutRoutinesApi.create(session!.token, {
        name,
        description: description || undefined,
        dayOfWeek: dayOfWeek && dayOfWeek !== "none" ? parseInt(dayOfWeek) : undefined,
      }),
    onSuccess: (routine) => {
      toast({ title: "Rotina criada!" });
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setDayOfWeek("");
      navigate(`/paciente/treinos/${routine.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workoutRoutinesApi.remove(session!.token, id),
    onSuccess: () => {
      toast({ title: "Rotina removida." });
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
    },
  });

  const routines = routinesQuery.data ?? [];
  const activeRoutines = routines.filter((r: WorkoutRoutine) => r.isActive);
  const inactiveRoutines = routines.filter((r: WorkoutRoutine) => !r.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rotinas de Treino</h1>
          <p className="text-muted-foreground">Gerencie suas rotinas de exercicios</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nova rotina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar rotina de treino</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Treino A - Peito e Triceps"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descricao (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes sobre a rotina..."
                />
              </div>
              <div className="space-y-2">
                <Label>Dia da semana (opcional)</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer dia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer dia</SelectItem>
                    <SelectItem value="1">Segunda-feira</SelectItem>
                    <SelectItem value="2">Terca-feira</SelectItem>
                    <SelectItem value="3">Quarta-feira</SelectItem>
                    <SelectItem value="4">Quinta-feira</SelectItem>
                    <SelectItem value="5">Sexta-feira</SelectItem>
                    <SelectItem value="6">Sabado</SelectItem>
                    <SelectItem value="0">Domingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar rotina
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {routinesQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!routinesQuery.isLoading && routines.length === 0 && (
        <Card className="p-12 text-center">
          <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma rotina cadastrada</h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira rotina de treino para comecar a acompanhar seus exercicios.
          </p>
        </Card>
      )}

      {activeRoutines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Rotinas ativas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {activeRoutines.map((routine: WorkoutRoutine) => (
              <Card
                key={routine.id}
                className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/paciente/treinos/${routine.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{routine.name}</h3>
                    {routine.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {routine.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{getDayOfWeekLabel(routine.dayOfWeek)}</span>
                      <span>{routine.exercises.length} exercicio(s)</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(routine.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {inactiveRoutines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Rotinas inativas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {inactiveRoutines.map((routine: WorkoutRoutine) => (
              <Card
                key={routine.id}
                className="p-4 opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/paciente/treinos/${routine.id}`)}
              >
                <h3 className="font-medium">{routine.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {routine.exercises.length} exercicio(s)
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
