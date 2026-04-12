import { Mail, RefreshCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function PerfilMedico() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  async function handleRefreshProfile() {
    try {
      await refreshProfile();
      toast({
        title: "Perfil sincronizado",
        description: "Os dados do medico foram atualizados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Nao foi possivel atualizar o perfil",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  }

  return (
    <DoctorLayout>
      <div className="animate-slide-up max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Meu perfil</h1>
            <p className="text-muted-foreground">
              Dados carregados a partir do cadastro autenticado na Clinix.
            </p>
          </div>
          <Button variant="outline" onClick={handleRefreshProfile}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar dados
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>{profile?.name ?? "Medico"}</CardTitle>
              <CardDescription>
                Informacoes principais do profissional autenticado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  {profile?.email ?? "Nao informado"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Registro profissional</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {profile?.professionalRegister ?? "Nao informado"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Especialidades</CardTitle>
              <CardDescription>
                Especialidades retornadas pelo backend no contexto autenticado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(profile?.specialties?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(profile?.specialties ?? []).map((specialty) => (
                    <span
                      key={specialty}
                      className="status-badge bg-primary/10 px-3 py-2 text-primary"
                    >
                      <Stethoscope className="mr-1 inline h-3.5 w-3.5" />
                      {specialty}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                  Nenhuma especialidade foi retornada para este cadastro.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorLayout>
  );
}
