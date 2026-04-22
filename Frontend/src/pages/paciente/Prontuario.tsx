import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  FileText,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PatientLayout } from "@/components/layouts/PatientLayout";
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
import { clinicalRecordsApi, usersApi } from "@/lib/api/clinix-api";
import {
  getClinicalAccessGrantStatusLabel,
  getClinicalEntryTypeLabel,
  getInitials,
  resolveClinicalAccessGrantStatus,
  resolveClinicalEntryAuthorType,
  resolveClinicalEntryType,
} from "@/lib/api/domain";
import { formatDateLabel, formatDateTime } from "@/lib/date-utils";
import { buildSpecialties, loadDirectoryUsers } from "@/lib/directory";
import { downloadBlob } from "@/lib/files";

export default function Prontuario() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [grantReason, setGrantReason] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["clinical-record", "summary", profile?.userId],
    queryFn: () => clinicalRecordsApi.getSummary(session!.token, profile!.userId),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const entriesQuery = useQuery({
    queryKey: ["clinical-record", "entries", profile?.userId],
    queryFn: () => clinicalRecordsApi.getEntries(session!.token, profile!.userId),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const accessGrantsQuery = useQuery({
    queryKey: ["clinical-record", "access-grants", profile?.userId],
    queryFn: () => clinicalRecordsApi.getAccessGrants(session!.token, profile!.userId),
    enabled: Boolean(session?.token && profile?.userId),
  });

  const doctorsQuery = useQuery({
    queryKey: ["directory", "doctors", "grant-options"],
    queryFn: () => usersApi.getDoctors(session!.token, { limit: 100 }),
    enabled: Boolean(session?.token),
  });

  const directoryUsersQuery = useQuery({
    queryKey: [
      "directory",
      "users",
      "clinical-record",
      ...(entriesQuery.data ?? []).map((entry) => entry.authorUserId).sort(),
      ...(accessGrantsQuery.data ?? []).map((grant) => grant.doctorId).sort(),
    ],
    queryFn: () =>
      loadDirectoryUsers(session!.token, [
        ...(entriesQuery.data ?? []).map((entry) => entry.authorUserId),
        ...(accessGrantsQuery.data ?? []).map((grant) => grant.doctorId),
      ]),
    enabled: Boolean(
      session?.token &&
        ((entriesQuery.data?.length ?? 0) > 0 || (accessGrantsQuery.data?.length ?? 0) > 0),
    ),
  });

  const createGrantMutation = useMutation({
    mutationFn: () =>
      clinicalRecordsApi.createAccessGrant(session!.token, profile!.userId, {
        doctorId: selectedDoctorId,
        reason: grantReason.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "access-grants"] });
      setGrantDialogOpen(false);
      setSelectedDoctorId("");
      setGrantReason("");
      toast({
        title: "Acesso concedido",
        description: "O médico selecionado agora pode consultar seu histórico conforme as regras vigentes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível conceder o acesso",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const revokeGrantMutation = useMutation({
    mutationFn: (grantId: string) =>
      clinicalRecordsApi.revokeAccessGrant(session!.token, profile!.userId, grantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "access-grants"] });
      toast({
        title: "Acesso revogado",
        description: "O compartilhamento foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível revogar o acesso",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const documents = useMemo(
    () =>
      (entriesQuery.data ?? []).flatMap((entry) =>
        entry.documents.map((document) => ({
          ...document,
          entryId: entry.id,
          entryTitle: entry.title,
        })),
      ),
    [entriesQuery.data],
  );

  const activeDoctors = useMemo(() => {
    const selectedGrantIds = new Set(
      (accessGrantsQuery.data ?? [])
        .filter((grant) => resolveClinicalAccessGrantStatus(grant.status) === "Active")
        .map((grant) => grant.doctorId),
    );

    return (doctorsQuery.data ?? []).filter((doctor) => !selectedGrantIds.has(doctor.userId));
  }, [accessGrantsQuery.data, doctorsQuery.data]);

  async function handleDownload(documentId: string, fileName: string) {
    try {
      const blob = await clinicalRecordsApi.downloadDocument(
        session!.token,
        profile!.userId,
        documentId,
      );
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

  function getUserName(userId: string) {
    return directoryUsersQuery.data?.[userId]?.name ?? "Profissional";
  }

  const specialties = buildSpecialties(doctorsQuery.data ?? []);

  return (
    <PatientLayout>
      <div className="animate-slide-up space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {getInitials(profile?.name ?? "Paciente")}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">{profile?.name ?? "Paciente"}</h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{profile?.email}</span>
                    <span>{summaryQuery.data?.activeEntriesCount ?? 0} registros ativos</span>
                    <span>{summaryQuery.data?.activeDocumentsCount ?? 0} documentos</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-secondary/50 px-4 py-3 text-right">
                  <p className="text-xs text-muted-foreground">Acessos ativos</p>
                  <p className="text-lg font-semibold">
                    {summaryQuery.data?.activeAccessGrantsCount ?? 0}
                  </p>
                </div>
              </div>
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
            <TabsTrigger value="acessos" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Acessos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            {entriesQuery.isLoading ? (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="text-muted-foreground">Carregando histórico clínico...</p>
              </Card>
            ) : (entriesQuery.data?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {(entriesQuery.data ?? []).map((entry) => {
                  const authorType = resolveClinicalEntryAuthorType(entry.authorType);
                  const entryType = resolveClinicalEntryType(entry.entryType);

                  return (
                    <Card key={entry.id} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{entry.title}</h3>
                            <span className="status-badge bg-primary/10 text-primary">
                              {getClinicalEntryTypeLabel(entryType)}
                            </span>
                            {!entry.isVisibleToPatient ? (
                              <span className="status-badge bg-warning/10 text-warning">
                                Uso interno
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(entry.createdAt)} • {authorType === "Doctor" ? getUserName(entry.authorUserId) : "Paciente"}
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {entry.description}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.documents.length} documento(s)
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="font-medium mb-2">Nenhum registro clínico ainda</p>
                <p className="text-sm text-muted-foreground">
                  As evoluções e os documentos aparecerão aqui conforme consultas e anexos forem registrados.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documentos">
            <div className="mb-4 flex justify-end">
              <Button variant="outline" onClick={() => navigate("/paciente/documentos")}>
                <Plus className="mr-2 h-4 w-4" />
                Enviar novo documento
              </Button>
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
                <p className="text-muted-foreground">Nenhum documento vinculado ao prontuário.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="acessos">
            <div className="flex justify-end mb-4">
              <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Conceder acesso
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Compartilhar prontuário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Médico</Label>
                      <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um médico" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDoctors.map((doctor) => (
                            <SelectItem key={doctor.userId} value={doctor.userId}>
                              {doctor.name} • {doctor.professionalRegister}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo do compartilhamento</Label>
                      <Textarea
                        value={grantReason}
                        onChange={(event) => setGrantReason(event.target.value)}
                        placeholder="Ex.: acompanhamento cardiológico, segunda opinião..."
                      />
                    </div>

                    {specialties.length > 0 ? (
                      <div className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
                        Especialidades disponíveis no cadastro: {specialties.join(", ")}. 
                      </div>
                    ) : null}

                    <Button
                      className="w-full"
                      onClick={() => createGrantMutation.mutate()}
                      disabled={
                        createGrantMutation.isPending ||
                        !selectedDoctorId ||
                        !grantReason.trim()
                      }
                    >
                      {createGrantMutation.isPending ? "Concedendo..." : "Conceder acesso"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {(accessGrantsQuery.data?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {(accessGrantsQuery.data ?? []).map((grant) => {
                  const status = resolveClinicalAccessGrantStatus(grant.status);

                  return (
                    <Card key={grant.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{getUserName(grant.doctorId)}</h3>
                            <span className="status-badge bg-primary/10 text-primary">
                              {getClinicalAccessGrantStatusLabel(status)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{grant.reason}</p>
                          <p className="text-sm text-muted-foreground">
                            Início: {formatDateLabel(grant.startAt)}
                          </p>
                        </div>

                        {status === "Active" ? (
                          <Button
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => revokeGrantMutation.mutate(grant.id)}
                            disabled={revokeGrantMutation.isPending}
                          >
                            <LockKeyhole className="w-4 h-4 mr-2" />
                            Revogar
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-10 text-center bg-secondary/30 border-dashed">
                <p className="font-medium mb-2">Nenhum acesso compartilhado</p>
                <p className="text-sm text-muted-foreground">
                  Compartilhe seu histórico com médicos quando precisar de acompanhamento.
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
}
