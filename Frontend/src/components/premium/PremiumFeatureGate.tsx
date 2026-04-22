import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

interface PremiumFeatureGateProps {
  children: ReactNode;
  featureName?: string;
}

export function PremiumFeatureGate({ children, featureName = "este recurso" }: PremiumFeatureGateProps) {
  const { isPremium } = useAuth();
  const navigate = useNavigate();

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Recurso Premium</h2>
        <p className="text-muted-foreground">
          Para acessar {featureName}, ative sua assinatura Premium.
          Comece com um teste gratuito de 14 dias, sem necessidade de cartao de credito.
        </p>
        <Button onClick={() => navigate("/paciente/assinatura")} className="gap-2">
          <Crown className="w-4 h-4" />
          Ver planos
        </Button>
      </Card>
    </div>
  );
}
