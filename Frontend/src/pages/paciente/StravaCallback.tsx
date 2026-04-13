import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { stravaApi } from "@/lib/api/clinix-api";

export default function StravaCallback() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      toast({ title: "Conexao negada", description: "Voce negou acesso ao Strava.", variant: "destructive" });
      navigate("/paciente/strava", { replace: true });
      return;
    }

    if (!code || !session?.token) {
      navigate("/paciente/strava", { replace: true });
      return;
    }

    stravaApi.callback(session.token, code)
      .then(() => {
        toast({ title: "Strava conectado com sucesso!" });
        navigate("/paciente/strava", { replace: true });
      })
      .catch((err: Error) => {
        toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
        navigate("/paciente/strava", { replace: true });
      });
  }, [searchParams, session?.token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Conectando ao Strava...</p>
      </div>
    </div>
  );
}
