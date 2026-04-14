import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { resolveHomePath, useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { HEALTH_INSURANCE_PLANS } from "@/lib/health-insurance-plans";

const especialidades = [
  "Cardiologia",
  "Dermatologia",
  "Ortopedia",
  "Pediatria",
  "Ginecologia",
  "Neurologia",
  "Oftalmologia",
  "Psiquiatria",
];

const estados = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "DF"];

export default function CadastroMedico() {
  const navigate = useNavigate();
  const { registerDoctor } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    crm: "",
    estado: "",
    telefone: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    consultationPrice: "",
  });
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  }

  function handleSelectChange(name: string, value: string) {
    setFormData({ ...formData, [name]: value });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (formData.senha !== formData.confirmarSenha) {
      toast({
        title: "Senhas diferentes",
        description: "Confira a confirmação da senha antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    if (selectedSpecialties.length === 0) {
      toast({
        title: "Especialidade obrigatória",
        description: "Selecione ao menos uma especialidade para concluir o cadastro.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const professionalRegister = [formData.crm.trim(), formData.estado.trim()]
        .filter(Boolean)
        .join("/");

      const priceValue = parseFloat(formData.consultationPrice);

      const session = await registerDoctor({
        name: formData.nome.trim(),
        professionalRegister,
        specialties: selectedSpecialties,
        email: formData.email.trim(),
        phone: formData.telefone.trim(),
        password: formData.senha,
        consultationPriceCents: !isNaN(priceValue) && priceValue > 0
          ? Math.round(priceValue * 100)
          : undefined,
        acceptedInsurancePlans: selectedPlans.length > 0 ? selectedPlans : undefined,
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
            <CardTitle className="text-2xl">Cadastro de Médico</CardTitle>
            <CardDescription>
              Preencha os dados profissionais suportados pelo cadastro Clinix
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  name="nome"
                  placeholder="Dr(a). Nome completo"
                  value={formData.nome}
                  onChange={handleChange}
                  className="input-focus"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="crm">CRM</Label>
                  <Input
                    id="crm"
                    name="crm"
                    placeholder="Número do CRM"
                    value={formData.crm}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(value) => handleSelectChange("estado", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="input-focus">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {estados.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Especialidades</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!selectedSpecialties.includes(value)) {
                      setSelectedSpecialties((prev) => [...prev, value]);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="input-focus">
                    <SelectValue placeholder="Adicionar especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidades
                      .filter((e) => !selectedSpecialties.includes(e))
                      .map((especialidade) => (
                        <SelectItem key={especialidade} value={especialidade}>
                          {especialidade}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedSpecialties.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedSpecialties.map((spec) => (
                      <Badge key={spec} variant="secondary" className="gap-1 pr-1">
                        {spec}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSpecialties((prev) =>
                              prev.filter((s) => s !== spec),
                            )
                          }
                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          disabled={isSubmitting}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultationPrice">Preço da consulta particular (R$)</Label>
                <Input
                  id="consultationPrice"
                  name="consultationPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 250.00"
                  value={formData.consultationPrice}
                  onChange={handleChange}
                  className="input-focus"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Planos de saúde aceitos (opcional)</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!selectedPlans.includes(value)) {
                      setSelectedPlans((prev) => [...prev, value]);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="input-focus">
                    <SelectValue placeholder="Adicionar plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {HEALTH_INSURANCE_PLANS.filter((p) => !selectedPlans.includes(p)).map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPlans.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedPlans.map((plan) => (
                      <Badge key={plan} variant="secondary" className="gap-1 pr-1">
                        {plan}
                        <button
                          type="button"
                          onClick={() => setSelectedPlans((prev) => prev.filter((p) => p !== plan))}
                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          disabled={isSubmitting}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone profissional</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    placeholder="(11) 9999-99999"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="input-focus"
                    disabled={isSubmitting}
                  />
                </div>
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

              <div className="bg-secondary/50 rounded-lg p-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Próximo passo:</strong> após o cadastro, você poderá
                  configurar seus horários de atendimento e ajustar suas informações no painel.
                </p>
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
                  {isSubmitting ? "Criando conta..." : "Concluir cadastro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
