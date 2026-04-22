import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subscriptionsApi } from "@/lib/api/clinix-api";
import {
  SubscriptionResponse,
  getSubscriptionStatusLabel,
  resolveSubscriptionStatus,
} from "@/lib/api/domain";

function isSubscriptionResponse(data: unknown): data is SubscriptionResponse {
  return data != null && typeof data === "object" && "id" in data;
}

export default function Assinatura() {
  const { session, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => subscriptionsApi.getMySubscription(session!.token),
    enabled: Boolean(session?.token),
  });

  const sub = subscriptionQuery.data && isSubscriptionResponse(subscriptionQuery.data)
    ? subscriptionQuery.data
    : null;

  const resolvedStatus = sub ? resolveSubscriptionStatus(sub.status) : null;
  const isActive = resolvedStatus === "Trialing" || resolvedStatus === "Active";

  const startTrialMutation = useMutation({
    mutationFn: () => subscriptionsApi.startTrial(session!.token),
    onSuccess: () => {
      toast({ title: "Teste gratuito ativado!", description: "Aproveite todos os recursos premium." });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      refreshSubscription();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.createCheckout(
        session!.token,
        `${window.location.origin}/paciente/assinatura?success=true`,
        `${window.location.origin}/paciente/assinatura?canceled=true`,
      ),
    onSuccess: (data) => {
      window.location.href = data.sessionUrl;
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  async function handleCancel() {
    setCanceling(true);
    try {
      await subscriptionsApi.cancel(session!.token);
      toast({ title: "Assinatura cancelada." });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      refreshSubscription();
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao cancelar.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  }

  const premiumFeatures = [
    "Registro de rotinas de treino personalizadas",
    "Integração com Strava para acompanhamento de atividades",
    "Monitoramento multiprofissional de desempenho",
    "Histórico completo de atividades físicas",
  ];

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assinatura</h1>
          <p className="text-muted-foreground">Gerencie seu plano Premium</p>
        </div>

        {subscriptionQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!subscriptionQuery.isLoading && !sub && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 space-y-4 border-border">
              <h3 className="text-lg font-semibold">Plano Gratuito</h3>
              <p className="text-muted-foreground text-sm">Funcionalidades básicas do Clinix</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" /> Agendamento de consultas
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" /> Prontuário clínico
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" /> Assistente virtual
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Rotinas de treino</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Integração Strava</span>
                </li>
              </ul>
              <p className="text-2xl font-bold">Grátis</p>
            </Card>

            <Card className="p-6 space-y-4 border-primary relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Recomendado
                </span>
              </div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" /> Plano Premium
              </h3>
              <p className="text-muted-foreground text-sm">
                Tudo do plano gratuito + recursos exclusivos
              </p>
              <ul className="space-y-2 text-sm">
                {premiumFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" /> {feature}
                  </li>
                ))}
              </ul>
              <p className="text-2xl font-bold">
                14 dias grátis
                <span className="text-sm font-normal text-muted-foreground block">
                  sem cartão de crédito
                </span>
              </p>
              <Button
                className="w-full gap-2"
                onClick={() => startTrialMutation.mutate()}
                disabled={startTrialMutation.isPending}
              >
                {startTrialMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4" />
                )}
                Iniciar teste gratuito
              </Button>
            </Card>
          </div>
        )}

        {!subscriptionQuery.isLoading && sub && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Plano Premium</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: {getSubscriptionStatusLabel(resolvedStatus)}
                  </p>
                </div>
              </div>
              {isActive && (
                <span className="bg-green-500/10 text-green-600 text-xs font-medium px-3 py-1 rounded-full">
                  Ativo
                </span>
              )}
            </div>

            {resolvedStatus === "Trialing" && sub.trialDaysRemaining != null && (
              <div className="bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-medium">
                  Período de teste: {sub.trialDaysRemaining} dias restantes
                </p>
                {sub.trialEndsAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em {new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {(resolvedStatus === "Canceled" || resolvedStatus === "Expired") && (
                <Button
                  onClick={() => startTrialMutation.mutate()}
                  disabled={startTrialMutation.isPending}
                  className="gap-2"
                >
                  {startTrialMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4" />
                  )}
                  Reativar teste gratuito
                </Button>
              )}
              {(resolvedStatus === "Trialing" || resolvedStatus === "Expired" || resolvedStatus === "Canceled") && (
                <Button
                  variant="outline"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  className="gap-2"
                >
                  {checkoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Assinar Premium
                </Button>
              )}
              {isActive && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={canceling}
                  className="text-destructive"
                >
                  {canceling && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Cancelar assinatura
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </PatientLayout>
  );
}
