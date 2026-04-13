import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Dumbbell, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { workoutRoutinesApi } from "@/lib/api/clinix-api";
import { getDayOfWeekLabel, normalizeDayOfWeek, WorkoutExercise } from "@/lib/api/domain";

export default function RotinaTreinoDetalhe() {
  return (
    <PatientLayout>
      <PremiumFeatureGate featureName="rotinas de treino">
        <RoutineDetail />
      </PremiumFeatureGate>
    </PatientLayout>
  );
}

function RoutineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("3");
  const [exReps, setExReps] = useState("12");
  const [exDuration, setExDuration] = useState("");
  const [exRest, setExRest] = useState("");
  const [exNotes, setExNotes] = useState("");
  const [exOrder, setExOrder] = useState("0");

  const routineQuery = useQuery({
    queryKey: ["workout-routines", id],
    queryFn: () => workoutRoutinesApi.get(session!.token, id!),
    enabled: Boolean(session?.token && id),
  });

  const routine = routineQuery.data;

  const [initialized, setInitialized] = useState(false);
  if (routine && !initialized) {
    setName(routine.name);
    setDescription(routine.description ?? "");
    const normalizedDay = normalizeDayOfWeek(routine.dayOfWeek);
    setDayOfWeek(normalizedDay != null ? String(normalizedDay) : "none");
    setIsActive(routine.isActive);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      workoutRoutinesApi.update(session!.token, id!, {
        name,
        description: description || undefined,
        dayOfWeek: dayOfWeek && dayOfWeek !== "none" ? parseInt(dayOfWeek) : undefined,
        isActive,
      }),
    onSuccess: () => {
      toast({ title: "Rotina atualizada!" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["workout-routines"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const addExerciseMutation = useMutation({
    mutationFn: () =>
      workoutRoutinesApi.addExercise(session!.token, id!, {
        name: exName,
        sets: parseInt(exSets),
        reps: parseInt(exReps),
        durationMinutes: exDuration ? parseInt(exDuration) : undefined,
        restSeconds: exRest ? parseInt(exRest) : undefined,
        notes: exNotes || undefined,
        order: parseInt(exOrder),
      }),
    onSuccess: () => {
      toast({ title: "Exercicio adicionado!" });
      queryClient.invalidateQueries({ queryKey: ["workout-routines", id] });
      resetExerciseForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: () =>
      workoutRoutinesApi.updateExercise(session!.token, id!, editingExercise!.id, {
        name: exName,
        sets: parseInt(exSets),
        reps: parseInt(exReps),
        durationMinutes: exDuration ? parseInt(exDuration) : undefined,
        restSeconds: exRest ? parseInt(exRest) : undefined,
        notes: exNotes || undefined,
        order: parseInt(exOrder),
      }),
    onSuccess: () => {
      toast({ title: "Exercicio atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["workout-routines", id] });
      resetExerciseForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (exerciseId: string) =>
      workoutRoutinesApi.removeExercise(session!.token, id!, exerciseId),
    onSuccess: () => {
      toast({ title: "Exercicio removido." });
      queryClient.invalidateQueries({ queryKey: ["workout-routines", id] });
    },
  });

  function resetExerciseForm() {
    setExerciseDialogOpen(false);
    setEditingExercise(null);
    setExName("");
    setExSets("3");
    setExReps("12");
    setExDuration("");
    setExRest("");
    setExNotes("");
    setExOrder("0");
  }

  function openAddExercise() {
    resetExerciseForm();
    setExOrder(String(routine?.exercises?.length ?? 0));
    setExerciseDialogOpen(true);
  }

  function openEditExercise(exercise: WorkoutExercise) {
    setEditingExercise(exercise);
    setExName(exercise.name);
    setExSets(String(exercise.sets));
    setExReps(String(exercise.reps));
    setExDuration(exercise.durationMinutes != null ? String(exercise.durationMinutes) : "");
    setExRest(exercise.restSeconds != null ? String(exercise.restSeconds) : "");
    setExNotes(exercise.notes ?? "");
    setExOrder(String(exercise.order));
    setExerciseDialogOpen(true);
  }

  if (routineQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Rotina nao encontrada.</p>
        <Button variant="link" onClick={() => navigate("/paciente/treinos")}>
          Voltar para rotinas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/paciente/treinos")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{routine.name}</h1>
          <p className="text-sm text-muted-foreground">{getDayOfWeekLabel(routine.dayOfWeek)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setEditing(!editing)}
        >
          <Pencil className="w-4 h-4" />
          {editing ? "Cancelar" : "Editar"}
        </Button>
      </div>

      {editing && (
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Dia da semana</Label>
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
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Rotina ativa</Label>
          </div>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alteracoes
          </Button>
        </Card>
      )}

      {routine.description && !editing && (
        <p className="text-muted-foreground">{routine.description}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Exercicios</h2>
          <Button size="sm" className="gap-2" onClick={openAddExercise}>
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>

        {routine.exercises.length === 0 && (
          <Card className="p-8 text-center">
            <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum exercicio cadastrado nesta rotina.</p>
          </Card>
        )}

        <div className="space-y-2">
          {routine.exercises.map((exercise: WorkoutExercise, index: number) => (
            <Card key={exercise.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-medium">{exercise.name}</h4>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                      <span>{exercise.sets} series</span>
                      <span>{exercise.reps} reps</span>
                      {exercise.durationMinutes != null && <span>{exercise.durationMinutes} min</span>}
                      {exercise.restSeconds != null && <span>{exercise.restSeconds}s descanso</span>}
                    </div>
                    {exercise.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{exercise.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditExercise(exercise)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteExerciseMutation.mutate(exercise.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={exerciseDialogOpen} onOpenChange={(open) => { if (!open) resetExerciseForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExercise ? "Editar exercicio" : "Adicionar exercicio"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingExercise) {
                updateExerciseMutation.mutate();
              } else {
                addExerciseMutation.mutate();
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome do exercicio</Label>
              <Input
                value={exName}
                onChange={(e) => setExName(e.target.value)}
                placeholder="Ex: Supino reto"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Series</Label>
                <Input type="number" min="1" value={exSets} onChange={(e) => setExSets(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Repeticoes</Label>
                <Input type="number" min="1" value={exReps} onChange={(e) => setExReps(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duracao (min)</Label>
                <Input type="number" min="0" value={exDuration} onChange={(e) => setExDuration(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Descanso (seg)</Label>
                <Input type="number" min="0" value={exRest} onChange={(e) => setExRest(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea value={exNotes} onChange={(e) => setExNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Input type="hidden" value={exOrder} />
            <Button
              type="submit"
              className="w-full"
              disabled={addExerciseMutation.isPending || updateExerciseMutation.isPending || !exName.trim()}
            >
              {(addExerciseMutation.isPending || updateExerciseMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {editingExercise ? "Salvar" : "Adicionar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
