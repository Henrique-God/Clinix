import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Calendar, Check, Clock, MapPin, Stethoscope, User } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi, usersApi } from "@/lib/api/clinix-api";
import { formatDateTime, getAppointmentTimeRange } from "@/lib/date-utils";

const steps = [
  { id: "especialidade", label: "Especialidade" },
  { id: "medico", label: "Médico" },
  { id: "data-hora", label: "Data e Hora" },
  { id: "confirmacao", label: "Confirmação" },
];

export default function ConfirmacaoAgendamento() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { toast } = useToast();

  const especialidade = searchParams.get("especialidade") || "";
  const medico = searchParams.get("medico") || "";
  const inicio = searchParams.get("inicio") || "";
  const fim = searchParams.get("fim") || "";

  const doctorQuery = useQuery({
    queryKey: ["directory", "user", medico],
    queryFn: () => usersApi.getDirectoryUser(session!.token, medico),
    enabled: Boolean(session?.token && medico),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      appointmentsApi.inviteAppointment(session!.token, {
        doctorId: medico,
        patientId: profile!.userId,
        startTime: inicio,
        endTime: fim,
        invitationExpiresAt: inicio,
        title: `Consulta - ${especialidade}`,
        description: `Convite de consulta enviado pela área do paciente para ${especialidade}.`,
        location: "Clinix",
        invitationMessage: "Solicitacao realizada pela plataforma Clinix.",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "patient"] });
      toast({
        title: "Solicitação enviada com sucesso",
        description: "O médico poderá aceitar ou recusar o convite antes do horário marcado.",
      });
      navigate("/paciente/consultas", { replace: true });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível enviar o convite",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Stepper steps={steps} currentStep={3} />
        </div>

        <Card className="p-6 sm:p-8 animate-slide-up shadow-card">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Confirmação</h1>
          <p className="text-muted-foreground text-center mb-8">
            Revise os detalhes antes de enviar a solicitação ao médico.
          </p>

          <div className="bg-secondary/30 rounded-xl p-6 mb-6 max-w-xl mx-auto">
            <h2 className="font-semibold mb-4 text-lg">Resumo da consulta</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Especialidade</p>
                  <p className="font-medium">{especialidade}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Médico</p>
                  <p className="font-medium">
                    {doctorQuery.data?.name ?? (doctorQuery.isLoading ? "Carregando..." : medico)}
                  </p>
                  {doctorQuery.data?.professionalRegister ? (
                    <p className="text-sm text-muted-foreground">
                      {doctorQuery.data.professionalRegister}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Data e hora</p>
                  <p className="font-medium capitalize">{formatDateTime(inicio)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getAppointmentTimeRange(inicio, fim)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Local</p>
                  <p className="font-medium">Clinix</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-8 max-w-xl mx-auto flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Esta solicitação cria um convite de consulta com status inicial pendente.</p>
              <p>O convite permanece válido até o horário de início da consulta.</p>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={inviteMutation.isPending}>
              Voltar
            </Button>
            <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Enviando..." : "Confirmar solicitação"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
