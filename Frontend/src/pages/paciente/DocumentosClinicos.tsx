import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Download, FileUp, Search, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { chatbotApi, clinicalRecordsApi } from "@/lib/api/clinix-api";
import { formatDateLabel } from "@/lib/date-utils";
import { downloadBlob } from "@/lib/files";

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export default function DocumentosClinicos() {
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [clinicalQuestion, setClinicalQuestion] = useState("");
  const [lastIngestionId, setLastIngestionId] = useState<string | null>(null);
  const [ragAnswer, setRagAnswer] = useState<{
    answer: string;
    sources: Array<Record<string, unknown>>;
  } | null>(null);

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

  const ingestionStatusQuery = useQuery({
    queryKey: ["chatbot", "documents", "ingestion-status", lastIngestionId],
    queryFn: () => chatbotApi.getIngestionStatus(session!.token, lastIngestionId!),
    enabled: Boolean(session?.token && lastIngestionId),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 3000 : false,
  });

  useEffect(() => {
    if (ingestionStatusQuery.data?.status !== "completed") {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["clinical-record", "summary"] });
    void queryClient.invalidateQueries({ queryKey: ["clinical-record", "entries"] });
  }, [ingestionStatusQuery.data?.status, queryClient]);

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

  const manualUploadMutation = useMutation({
    mutationFn: async () => {
      const file = documentFile;
      if (!file) {
        throw new Error("Selecione um arquivo antes de enviar.");
      }

      const entry = await clinicalRecordsApi.createEntry(session!.token, profile!.userId, {
        entryType: "Document",
        title: documentTitle.trim(),
        description: documentDescription.trim(),
        isVisibleToPatient: true,
      });

      await clinicalRecordsApi.uploadDocument(session!.token, profile!.userId, entry.id, file);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "summary"] });
      await queryClient.invalidateQueries({ queryKey: ["clinical-record", "entries"] });
      setDocumentTitle("");
      setDocumentDescription("");
      setDocumentFile(null);
      toast({
        title: "Documento enviado",
        description: "O arquivo ja esta disponivel no seu prontuario Clinix.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel enviar o documento",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const ingestionMutation = useMutation({
    mutationFn: async () => {
      if (!aiFile) {
        throw new Error("Selecione um arquivo para a extracao por IA.");
      }

      return chatbotApi.ingestDocument(session!.token, {
        file: aiFile,
        patientId: profile!.userId,
      });
    },
    onSuccess: (response) => {
      setLastIngestionId(response.ingestion_id);
      setAiFile(null);
      toast({
        title: "Extracao iniciada",
        description: "A Clinix esta processando o documento e indexando o conteudo.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel iniciar a extracao",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const ragMutation = useMutation({
    mutationFn: () =>
      chatbotApi.queryClinicalHistory(session!.token, {
        patient_id: profile!.userId,
        query: clinicalQuestion.trim(),
        top_k: 5,
      }),
    onSuccess: (response) => {
      setRagAnswer({
        answer: response.answer,
        sources: response.sources,
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel consultar o historico",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

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
        title: "Nao foi possivel baixar o documento",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  }

  const ingestionResult = ingestionStatusQuery.data?.result ?? null;
  const keyFindings = readStringList(ingestionResult?.key_findings);
  const ingestionSummary =
    typeof ingestionResult?.summary === "string" ? ingestionResult.summary : null;

  return (
    <PatientLayout>
      <div className="animate-slide-up space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Central de Documentos</h1>
            <p className="text-muted-foreground">
              Envie anexos para o prontuario, acompanhe a extracao por IA e consulte seu historico.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Registros</p>
              <p className="text-2xl font-semibold">
                {summaryQuery.data?.activeEntriesCount ?? 0}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Documentos</p>
              <p className="text-2xl font-semibold">
                {summaryQuery.data?.activeDocumentsCount ?? 0}
              </p>
            </Card>
            <Card className="p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Ultima ingestao</p>
              <p className="text-sm font-semibold">
                {ingestionStatusQuery.data?.status ?? "Nenhuma"}
              </p>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                Upload manual para o prontuario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document-title">Titulo do documento</Label>
                <Input
                  id="document-title"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="Ex: Exame de sangue de abril"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-description">Descricao clinica</Label>
                <Textarea
                  id="document-description"
                  value={documentDescription}
                  onChange={(event) => setDocumentDescription(event.target.value)}
                  placeholder="Contexto, motivo do exame e observacoes importantes."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-file">Arquivo</Label>
                <Input
                  id="document-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  manualUploadMutation.isPending ||
                  !documentTitle.trim() ||
                  !documentDescription.trim() ||
                  !documentFile
                }
                onClick={() => manualUploadMutation.mutate()}
              >
                {manualUploadMutation.isPending ? "Enviando..." : "Adicionar ao prontuario"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Extracao por IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esse fluxo usa o backend de IA para extrair texto, resumir achados e indexar o documento.
              </p>
              <div className="space-y-2">
                <Label htmlFor="ai-file">Arquivo para processamento</Label>
                <Input
                  id="ai-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(event) => setAiFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                className="w-full"
                disabled={ingestionMutation.isPending || !aiFile}
                onClick={() => ingestionMutation.mutate()}
              >
                {ingestionMutation.isPending ? "Iniciando..." : "Processar com IA"}
              </Button>

              {lastIngestionId ? (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Status da ingestao</p>
                      <p className="text-xs text-muted-foreground">{lastIngestionId}</p>
                    </div>
                    <span className="status-badge bg-primary/10 text-primary">
                      {ingestionStatusQuery.data?.status ?? "processing"}
                    </span>
                  </div>

                  {ingestionStatusQuery.data?.detail ? (
                    <p className="text-sm text-muted-foreground">
                      {ingestionStatusQuery.data.detail}
                    </p>
                  ) : null}

                  {ingestionSummary ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Resumo extraido</p>
                      <p className="text-sm text-muted-foreground">{ingestionSummary}</p>
                    </div>
                  ) : null}

                  {keyFindings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Principais achados</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {keyFindings.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Consulta inteligente ao historico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <Input
                value={clinicalQuestion}
                onChange={(event) => setClinicalQuestion(event.target.value)}
                placeholder="Ex: Quais foram os ultimos exames anexados ao meu prontuario?"
              />
              <Button
                className="lg:min-w-44"
                disabled={ragMutation.isPending || !clinicalQuestion.trim()}
                onClick={() => ragMutation.mutate()}
              >
                <Search className="mr-2 h-4 w-4" />
                {ragMutation.isPending ? "Consultando..." : "Perguntar ao historico"}
              </Button>
            </div>

            {ragAnswer ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                <p className="text-sm whitespace-pre-line">{ragAnswer.answer}</p>
                <p className="text-xs text-muted-foreground">
                  Fontes utilizadas: {ragAnswer.sources.length}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos disponiveis</CardTitle>
          </CardHeader>
          <CardContent>
            {entriesQuery.isLoading ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-10 text-center text-muted-foreground">
                Carregando documentos...
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-4">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{document.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {document.entryTitle} | {formatDateLabel(document.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(document.id, document.fileName)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Baixar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-10 text-center">
                <p className="font-medium">Nenhum documento no prontuario</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use o upload manual ou a extracao por IA para comecar a alimentar seu historico.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
