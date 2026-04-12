import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Plus, Stethoscope, Upload } from "lucide-react";
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
import { appointmentsApi, clinicalRecordsApi, usersApi } from "@/lib/api/clinix-api";
import {
  getClinicalEntryTypeLabel,
  getInitials,
  resolveAppointmentStatus,
  resolveClinicalEntryType,
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
        entryType: "Anamnesis",
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
        title: "",
        description: "",
        appointmentId: "none",
        isVisibleToPatient: "false",
      });
      toast({
        title: "Registro criado",
        description: "A nova evolucao clinica foi salva com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel criar o registro",
        description:
          error instanceof Error ? error.message : "Verifique permissao e consulta vinculada.",
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
        description: "O anexo foi incluido no prontuario com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel salvar o documento",
        description:
          error instanceof Error ? error.message : "Verifique a permissao clinica e tente novamente.",
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
        title: "Nao foi possivel baixar o documento",
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
                    <span>{completedAppointments.length} consultas concluidas</span>
                  </div>
                </div>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova evolucao
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova evolucao clinica</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Titulo</Label>
                      <Input
                        value={entryForm.title}
                        onChange={(event) =>
                          setEntryForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Ex: Evolucao pos consulta"
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
                        placeholder="Descreva a evolucao, conduta e proximos passos."
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
                          <SelectItem value="none">Nao vincular agora</SelectItem>
                          {completedAppointments.map((appointment) => (
                            <SelectItem key={appointment.id} value={appointment.id}>
                              {formatDateTime(appointment.startTime)} • {appointment.title}
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
                      {createEntryMutation.isPending ? "Salvando..." : "Salvar evolucao"}
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
              Historico
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <FileText className="w-4 h-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            {entriesQuery.isLoading ? (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="text-muted-foreground">Carregando prontuario...</p>
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
                        {formatDateTime(entry.createdAt)} • Autor:{" "}
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
                <p className="font-medium mb-2">Nenhuma evolucao cadastrada</p>
                <p className="text-sm text-muted-foreground">
                  Crie uma nova anotacao clinica quando houver permissao de escrita para este prontuario.
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
                    <DialogTitle>Novo documento clinico</DialogTitle>
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
                        placeholder="Contexto clinico do documento anexado."
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
                          O backend exige uma consulta concluida para anexos enviados por medico.
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
                          {document.entryTitle} • {formatDateLabel(document.createdAt)}
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
                <p className="text-muted-foreground">Nenhum documento disponivel neste prontuario.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
}
