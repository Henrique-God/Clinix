import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <h1 className="mb-4 text-4xl font-bold text-foreground">
          Bem-vindo a Clinix
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Conectando médicos e pacientes para uma jornada clínica melhor
        </p>
        <Button onClick={() => navigate("/")} size="lg">
          Acessar plataforma
        </Button>
      </div>
    </div>
  );
};

export default Index;
