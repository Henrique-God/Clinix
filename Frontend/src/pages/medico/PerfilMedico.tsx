import { useEffect, useState } from "react";
import { Mail, PencilLine, RefreshCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usersApi } from "@/lib/api/clinix-api";

export default function PerfilMedico() {
  const { session, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    professionalRegister: "",
    phone: "",
    specialties: "",
  });

  useEffect(() => {
    setFormData({
      name: profile?.name ?? "",
      professionalRegister: profile?.professionalRegister ?? "",
      phone: profile?.phone ?? "",
      specialties: (profile?.specialties ?? []).join(", "),
    });
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      await usersApi.updateDoctorProfile(session!.token, {
        name: formData.name.trim(),
        professionalRegister: formData.professionalRegister.trim(),
        phone: formData.phone.trim(),
        specialties: formData.specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      setDialogOpen(false);
      toast({
        title: "Perfil atualizado",
        description: "Os dados do mÃ©dico foram salvos com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "NÃ£o foi possÃ­vel atualizar o perfil",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  async function handleRefreshProfile() {
    try {
      await refreshProfile();
      toast({
        title: "Perfil sincronizado",
        description: "Os dados do mÃ©dico foram atualizados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "NÃ£o foi possÃ­vel atualizar o perfil",
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
              Dados carregados e atualizados a partir do cadastro autenticado na Clinix.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Editar dados
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar dados profissionais</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={formData.name}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Registro profissional</Label>
                    <Input
                      value={formData.professionalRegister}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          professionalRegister: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Especialidades</Label>
                    <Input
                      value={formData.specialties}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          specialties: event.target.value,
                        }))
                      }
                      placeholder="Ex: Cardiologia, Clinica Geral"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={
                      updateProfileMutation.isPending ||
                      !formData.name.trim() ||
                      !formData.professionalRegister.trim() ||
                      !formData.phone.trim() ||
                      !formData.specialties.trim()
                    }
                  >
                    {updateProfileMutation.isPending ? "Salvando..." : "Confirmar alteracoes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleRefreshProfile}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar dados
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>{profile?.name ?? "MÃ©dico"}</CardTitle>
              <CardDescription>
                InformaÃ§Ãµes principais do profissional autenticado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  {profile?.email ?? "Não informado"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Registro profissional</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {profile?.professionalRegister ?? "Não informado"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
                <p className="mt-1 font-medium">{profile?.phone ?? "Não informado"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Especialidades</CardTitle>
              <CardDescription>
                Especialidades associadas ao seu cadastro profissional.
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
