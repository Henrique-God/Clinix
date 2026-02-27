import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import doctorHero from "@/assets/doctor-hero.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<"patient" | "doctor">("patient");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simula login - redireciona para área correspondente
    if (userType === "patient") {
      navigate("/paciente/consultas");
    } else {
      navigate("/medico/painel");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img
            src={doctorHero}
            alt="Médico profissional"
            className="w-full max-w-sm mx-auto mb-8 rounded-2xl shadow-lg"
          />
          <p className="text-lg text-muted-foreground">
            Conectando médicos e pacientes para uma saúde melhor
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">
            Bem-vindo de volta
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Entre com suas credenciais para acessar sua conta
          </p>

          <Tabs value={userType} onValueChange={(v) => setUserType(v as "patient" | "doctor")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="patient">Paciente</TabsTrigger>
              <TabsTrigger value="doctor">Médico</TabsTrigger>
            </TabsList>

            <TabsContent value="patient">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-focus"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="doctor">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-doctor">E-mail</Label>
                  <Input
                    id="email-doctor"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-doctor">Senha</Label>
                  <Input
                    id="password-doctor"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-focus"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Entrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem uma conta?{" "}
            <button
              onClick={() => navigate("/cadastro/paciente")}
              className="text-primary hover:underline font-medium"
            >
              Criar conta
            </button>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Use: ana@paciente.com / senha qualquer
          </p>
        </div>
      </div>
    </div>
  );
}
