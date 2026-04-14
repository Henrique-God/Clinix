import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, Dumbbell, Download, FileText, Filter, Plus, Stethoscope, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi, clinicalRecordsApi, stravaApi, usersApi, workoutRoutinesApi } from "@/lib/api/clinix-api";
import {
  formatDistance,
  formatDuration,
  getClinicalEntryTypeLabel,
  getDayOfWeekLabel,
  getInitials,
  resolveAppointmentStatus,
  resolveClinicalEntryType,
  StravaActivityResponse,
  WorkoutRoutine,
} from "@/lib/api/domain";
import { formatDateLabel, formatDateTime } from "@/lib/date-utils";
import { downloadBlob } from "@/lib/files";

export default function ProntuarioPaciente() {
  const { id: patientId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    entryType: "Anamnesis" as "Anamnesis" | "Prescription" | "MedicalOrder",
    title: "",
    description: "",
    appointmentId: "none",
    isVisibleToPatient: "false",
  });
  const [documentForm, setDocumentForm] = useState({
    title: "",
    description: "",
    appointmentId: "",
    isVisibleToPatient: "true",
    file: null as File | null,
  });

  const patientQuery = useQuery({
    queryKey: ["directory", "user", patientId],
    queryFn: () => usersApi.getDirectoryUser(session!.token, patientId),
    enabled: Boolean(session?.token && patientId),
  });

  const summaryQuery = useQuery({
    queryKey: ["clinical-record", "summary", patientId],
    queryFn: () => clinicalRecordsApi.getSummary(session!.token, patientId),
    enabled: Boolean(session?.token && patientId),
  });

  const entriesQuery = useQuery({
    queryKey: ["clinical-record", "entries", patientId],
    queryFn: () => clinicalRecordsApi.getEntries(session!.token, patientId),
    enabled: Boolean(session?.token && patientId),
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "doctor", "patient-link", patientId],
    queryFn: () => appointmentsApi.listDoctorAppointments(session!.token),
    enabled: Boolean(session?.token),
  });

  const createEntryMutation = useMutation({
    mutationFn: () =>
      clinicalRecordsApi.createEntry(session!.token, patientId, {
        entryType: entryForm.entryType,
        title: entryForm.title.trim(),
        description: entryForm.description.trim(),
        appointmentId: entryForm.appointmentId !== "none" ? entryForm.appointmentId : undefined,
        isVisibleToPatient: entryForm.isVisibleToPatient === "true",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "entries", patientId] });
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "summary", patientId] });
      setDialogOpen(false);
      setEntryForm({
        entryType: "Anamnesis",
        title: "",
        description: "",
        appointmentId: "none",
        isVisibleToPatient: "false",
      });
      toast({
        title: "Registro criado",
        description: "A nova evolução clínica foi salva com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível criar o registro",
        description:
          error instanceof Error ? error.message : "Verifique a permissão e a consulta vinculada.",
        variant: "destructive",
      });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) {
        throw new Error("Selecione um arquivo antes de salvar.");
      }

      if (!documentForm.appointmentId) {
        throw new Error("Selecione a consulta concluida vinculada ao documento.");
      }

      const entry = await clinicalRecordsApi.createEntry(session!.token, patientId, {
        entryType: "Document",
        title: documentForm.title.trim(),
        description: documentForm.description.trim(),
        appointmentId: documentForm.appointmentId,
        isVisibleToPatient: documentForm.isVisibleToPatient === "true",
      });

      await clinicalRecordsApi.uploadDocument(
        session!.token,
        patientId,
        entry.id,
        documentForm.file,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "entries", patientId] });
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "summary", patientId] });
      setDocumentDialogOpen(false);
      setDocumentForm({
        title: "",
        description: "",
        appointmentId: "",
        isVisibleToPatient: "true",
        file: null,
      });
      toast({
        title: "Documento salvo",
        description: "O anexo foi incluído no prontuário com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível salvar o documento",
        description:
          error instanceof Error ? error.message : "Verifique a permissão clínica e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const documents = useMemo(
    () =>
      (entriesQuery.data ?? []).flatMap((entry) =>
        entry.documents.map((document) => ({
          ...document,
          entryTitle: entry.title,
        })),
      ),
    [entriesQuery.data],
  );

  const completedAppointments = useMemo(
    () =>
      (appointmentsQuery.data ?? []).filter((appointment) => {
        return (
          appointment.patientId === patientId &&
          resolveAppointmentStatus(appointment.status) === "Completed"
        );
      }),
    [appointmentsQuery.data, patientId],
  );

  async function handleDownload(documentId: string, fileName: string) {
    try {
      const blob = await clinicalRecordsApi.downloadDocument(session!.token, patientId, documentId);
      downloadBlob(blob, fileName);
    } catch (error) {
      toast({
        title: "Não foi possível baixar o documento",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        <button
          onClick={() => navigate("/medico/pacientes")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para lista
        </button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {getInitials(patientQuery.data?.name ?? "Paciente")}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">{patientQuery.data?.name ?? "Paciente"}</h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{summaryQuery.data?.activeEntriesCount ?? 0} registros</span>
                    <span>{summaryQuery.data?.activeDocumentsCount ?? 0} documentos</span>
                    <span>{completedAppointments.length} consultas concluídas</span>
                  </div>
                </div>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo registro
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo registro clínico</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de registro</Label>
                      <Select
                        value={entryForm.entryType}
                        onValueChange={(value) =>
                          setEntryForm((current) => ({
                            ...current,
                            entryType: value as "Anamnesis" | "Prescription" | "MedicalOrder",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Anamnesis">Evolução clínica</SelectItem>
                          <SelectItem value="Prescription">Receita</SelectItem>
                          <SelectItem value="MedicalOrder">Pedido médico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={entryForm.title}
                        onChange={(event) =>
                          setEntryForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Ex.: Evolução pós-consulta"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descricao</Label>
                      <Textarea
                        value={entryForm.description}
                        onChange={(event) =>
                          setEntryForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Descreva a evolução, a conduta e os próximos passos."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Consulta concluida vinculada</Label>
                      <Select
                        value={entryForm.appointmentId}
                        onValueChange={(value) =>
                          setEntryForm((current) => ({ ...current, appointmentId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma consulta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não vincular agora</SelectItem>
                          {completedAppointments.map((appointment) => (
                            <SelectItem key={appointment.id} value={appointment.id}>
                              {formatDateTime(appointment.startTime)} â€¢ {appointment.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilidade para o paciente</Label>
                      <Select
                        value={entryForm.isVisibleToPatient}
                        onValueChange={(value) =>
                          setEntryForm((current) => ({
                            ...current,
                            isVisibleToPatient: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Interno do profissional</SelectItem>
                          <SelectItem value="true">Visivel ao paciente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createEntryMutation.mutate()}
                      disabled={
                        createEntryMutation.isPending ||
                        !entryForm.title.trim() ||
                        !entryForm.description.trim()
                      }
                    >
                      {createEntryMutation.isPending ? "Salvando..." : "Salvar registro"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="historico">
          <TabsList className="mb-4">
            <TabsTrigger value="historico" className="gap-2">
              <Stethoscope className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <FileText className="w-4 h-4" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="strava" className="gap-2">
              <Activity className="w-4 h-4" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="treinos" className="gap-2">
              <Dumbbell className="w-4 h-4" />
              Treinos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            {entriesQuery.isLoading ? (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="text-muted-foreground">Carregando prontuário...</p>
              </Card>
            ) : (entriesQuery.data?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {(entriesQuery.data ?? []).map((entry) => (
                  <Card key={entry.id} className="p-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{entry.title}</h3>
                        <span className="status-badge bg-primary/10 text-primary">
                          {getClinicalEntryTypeLabel(resolveClinicalEntryType(entry.entryType))}
                        </span>
                        {!entry.isVisibleToPatient ? (
                          <span className="status-badge bg-warning/10 text-warning">
                            Uso interno
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(entry.createdAt)} â€¢ Autor:{" "}
                        {entry.authorUserId === profile?.userId ? profile?.name : "Outro profissional"}
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {entry.description}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="font-medium mb-2">Nenhuma evolução cadastrada</p>
                <p className="text-sm text-muted-foreground">
                  Crie uma nova anotação clínica quando houver permissão de escrita para este prontuário.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documentos">
            <div className="mb-4 flex justify-end">
              <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="mr-2 h-4 w-4" />
                    Novo documento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo documento clínico</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Titulo</Label>
                      <Input
                        value={documentForm.title}
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Ex: Pedido de exame complementar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descricao</Label>
                      <Textarea
                        value={documentForm.description}
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Contexto clínico do documento anexado."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Consulta concluida vinculada</Label>
                      <Select
                        value={documentForm.appointmentId}
                        onValueChange={(value) =>
                          setDocumentForm((current) => ({
                            ...current,
                            appointmentId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma consulta concluida" />
                        </SelectTrigger>
                        <SelectContent>
                          {completedAppointments.map((appointment) => (
                            <SelectItem key={appointment.id} value={appointment.id}>
                              {formatDateTime(appointment.startTime)} - {appointment.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {completedAppointments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Ã‰ necessÃ¡rio vincular o documento a uma consulta concluÃ­da antes de salvÃ¡-lo.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilidade para o paciente</Label>
                      <Select
                        value={documentForm.isVisibleToPatient}
                        onValueChange={(value) =>
                          setDocumentForm((current) => ({
                            ...current,
                            isVisibleToPatient: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Visivel ao paciente</SelectItem>
                          <SelectItem value="false">Uso interno do profissional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo</Label>
                      <Input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            file: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createDocumentMutation.mutate()}
                      disabled={
                        createDocumentMutation.isPending ||
                        !documentForm.title.trim() ||
                        !documentForm.description.trim() ||
                        !documentForm.appointmentId ||
                        !documentForm.file
                      }
                    >
                      {createDocumentMutation.isPending ? "Salvando..." : "Salvar documento"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {documents.length > 0 ? (
              <div className="space-y-4">
                {documents.map((document) => (
                  <Card key={document.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-medium">{document.fileName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {document.entryTitle} â€¢ {formatDateLabel(document.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleDownload(document.id, document.fileName)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="text-muted-foreground">Nenhum documento disponível neste prontuário.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="strava">
            <PatientStravaActivities patientId={patientId} token={session!.token} />
          </TabsContent>

          <TabsContent value="treinos">
            <PatientWorkoutRoutines patientId={patientId} token={session!.token} />
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
}

function PatientStravaActivities({ patientId, token }: { patientId: string; token: string }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const activitiesQuery = useQuery({
    queryKey: ["strava", "patient-activities", patientId],
    queryFn: () => stravaApi.listPatientActivities(token, patientId, 1, 200),
    enabled: Boolean(token && patientId),
  });

  const activities = activitiesQuery.data ?? [];

  const activityTypes = useMemo(() => {
    const types = new Set(activities.map((a: StravaActivityResponse) => a.type));
    return Array.from(types).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a: StravaActivityResponse) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      const actDate = new Date(a.startDate);
      if (dateFrom) {
        if (actDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (actDate > to) return false;
      }
      return true;
    });
  }, [activities, typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = typeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  if (activitiesQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (activitiesQuery.isError) {
    return (
      <Card className="p-8 text-center bg-secondary/30 border-dashed">
        <p className="text-muted-foreground">
          Não foi possível carregar as atividades. O paciente pode não ter conectado o Strava
          ou você pode não ter permissão de acesso.
        </p>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center bg-secondary/30 border-dashed">
        <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhuma atividade do Strava disponível para este paciente.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Atividades ({filteredActivities.length})</h3>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Filter className="w-3 h-3" /> Tipo
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {activityTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <Input
            type="date"
            className="w-[160px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ate</label>
          <Input
            type="date"
            className="w-[160px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="w-3 h-3" /> Limpar
          </Button>
        )}
      </div>

      {filteredActivities.length === 0 && (
        <Card className="p-8 text-center">
          <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma atividade corresponde aos filtros selecionados.</p>
        </Card>
      )}

      <div className="space-y-2">
        {filteredActivities.map((activity: StravaActivityResponse) => (
          <Card key={activity.id} className="p-4">
            <div>
              <h4 className="font-medium">{activity.name}</h4>
              <p className="text-xs text-muted-foreground">
                {activity.type} &middot;{" "}
                {new Date(activity.startDate).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <p className="text-xs text-muted-foreground">Distancia</p>
                <p className="text-sm font-medium">{formatDistance(activity.distanceMeters)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tempo</p>
                <p className="text-sm font-medium">{formatDuration(activity.movingTimeSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Elevacao</p>
                <p className="text-sm font-medium">{Math.round(activity.totalElevationGain)} m</p>
              </div>
              {activity.averageHeartRate != null && (
                <div>
                  <p className="text-xs text-muted-foreground">FC media</p>
                  <p className="text-sm font-medium">{Math.round(activity.averageHeartRate)} bpm</p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PatientWorkoutRoutines({ patientId, token }: { patientId: string; token: string }) {
  const routinesQuery = useQuery({
    queryKey: ["workout-routines", "patient", patientId],
    queryFn: () => workoutRoutinesApi.listPatientRoutines(token, patientId),
    enabled: Boolean(token && patientId),
  });

  if (routinesQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (routinesQuery.isError) {
    return (
      <Card className="p-8 text-center bg-secondary/30 border-dashed">
        <p className="text-muted-foreground">
          Não foi possível carregar as rotinas de treino. O paciente pode não ter rotinas cadastradas
          ou você pode não ter permissão de acesso.
        </p>
      </Card>
    );
  }

  const routines = routinesQuery.data ?? [];

  if (routines.length === 0) {
    return (
      <Card className="p-8 text-center bg-secondary/30 border-dashed">
        <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhuma rotina de treino cadastrada por este paciente.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {routines.map((routine: WorkoutRoutine) => (
        <Card key={routine.id} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold">{routine.name}</h4>
              <p className="text-xs text-muted-foreground">
                {getDayOfWeekLabel(routine.dayOfWeek)} &middot; {routine.exercises.length} exercicio(s)
              </p>
            </div>
          </div>
          {routine.description && (
            <p className="text-sm text-muted-foreground mb-3">{routine.description}</p>
          )}
          {routine.exercises.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Exercicio</th>
                    <th className="text-center p-2 font-medium">Series</th>
                    <th className="text-center p-2 font-medium">Reps</th>
                    <th className="text-center p-2 font-medium hidden sm:table-cell">Descanso</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {routine.exercises.map((exercise) => (
                    <tr key={exercise.id} className="border-t">
                      <td className="p-2">{exercise.name}</td>
                      <td className="p-2 text-center">{exercise.sets}</td>
                      <td className="p-2 text-center">{exercise.reps}</td>
                      <td className="p-2 text-center hidden sm:table-cell">
                        {exercise.restSeconds ? `${exercise.restSeconds}s` : "-"}
                      </td>
                      <td className="p-2 text-muted-foreground hidden md:table-cell">
                        {exercise.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
