import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveHomePath, useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { HEALTH_INSURANCE_PLANS } from "@/lib/health-insurance-plans";

export default function CadastroPaciente() {
  const navigate = useNavigate();
  const { registerPatient } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    dataNascimento: "",
    senha: "",
    confirmarSenha: "",
    planoSaude: "",
  });

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (formData.senha !== formData.confirmarSenha) {
      toast({
        title: "Senhas diferentes",
        description: "Confira a confirmacao da senha antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await registerPatient({
        name: formData.nome.trim(),
        email: formData.email.trim(),
        password: formData.senha,
        cpf: formData.cpf.trim() || undefined,
        phone: formData.telefone.trim() || undefined,
        dateOfBirth: formData.dataNascimento || undefined,
        healthInsurance: formData.planoSaude || undefined,
      });

      navigate(resolveHomePath(session.userType), { replace: true });
    } catch (error) {
      toast({
        title: "Não foi possível criar sua conta",
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          disabled={isSubmitting}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <Card className="animate-slide-up shadow-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo size="md" />
            </div>
            <CardTitle className="text-2xl">Cadastro de Paciente</CardTitle>
            <CardDescription>
              Crie sua conta com os dados disponíveis no cadastro atual da Clinix.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  name="nome"
                  placeholder="Seu nome completo"
                  value={formData.nome}
                  onChange={handleChange}
                  className="input-focus"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de nascimento</Label>
                  <Input
                    id="dataNascimento"
                    name="dataNascimento"
                    type="date"
                    value={formData.dataNascimento}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planoSaude">Plano de saúde</Label>
                <Select
                  value={formData.planoSaude}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, planoSaude: value }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="input-focus">
                    <SelectValue placeholder="Selecione seu plano (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {HEALTH_INSURANCE_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    name="senha"
                    type="password"
                    placeholder="Sua senha"
                    value={formData.senha}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmarSenha">Confirmar senha</Label>
                  <Input
                    id="confirmarSenha"
                    name="confirmarSenha"
                    type="password"
                    placeholder="Confirme sua senha"
                    value={formData.confirmarSenha}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "Criando conta..." : "Criar conta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
