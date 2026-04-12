import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/routing/PublicOnlyRoute";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ConfirmacaoAgendamento from "./pages/agendamento/ConfirmacaoAgendamento";
import SelecionarDataHora from "./pages/agendamento/SelecionarDataHora";
import SelecionarEspecialidade from "./pages/agendamento/SelecionarEspecialidade";
import SelecionarMedico from "./pages/agendamento/SelecionarMedico";
import CadastroMedico from "./pages/CadastroMedico";
import CadastroPaciente from "./pages/CadastroPaciente";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import GestaoHorarios from "./pages/medico/GestaoHorarios";
import ListaPacientes from "./pages/medico/ListaPacientes";
import PainelMedico from "./pages/medico/PainelMedico";
import PerfilMedico from "./pages/medico/PerfilMedico";
import ProntuarioPaciente from "./pages/medico/ProntuarioPaciente";
import ProntuariosMedico from "./pages/medico/ProntuariosMedico";
import AssistenteVirtual from "./pages/paciente/AssistenteVirtual";
import DocumentosClinicos from "./pages/paciente/DocumentosClinicos";
import MinhasConsultas from "./pages/paciente/MinhasConsultas";
import Prontuario from "./pages/paciente/Prontuario";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/" element={<Login />} />
              <Route path="/cadastro/paciente" element={<CadastroPaciente />} />
              <Route path="/cadastro/medico" element={<CadastroMedico />} />
            </Route>

            <Route element={<ProtectedRoute allowedUserTypes={["User"]} />}>
              <Route path="/agendar/especialidade" element={<SelecionarEspecialidade />} />
              <Route path="/agendar/medico" element={<SelecionarMedico />} />
              <Route path="/agendar/data-hora" element={<SelecionarDataHora />} />
              <Route path="/agendar/confirmacao" element={<ConfirmacaoAgendamento />} />
              <Route path="/paciente/consultas" element={<MinhasConsultas />} />
              <Route path="/paciente/prontuario" element={<Prontuario />} />
              <Route path="/paciente/documentos" element={<DocumentosClinicos />} />
              <Route path="/paciente/assistente" element={<AssistenteVirtual />} />
            </Route>

            <Route element={<ProtectedRoute allowedUserTypes={["Doctor"]} />}>
              <Route path="/medico/painel" element={<PainelMedico />} />
              <Route path="/medico/horarios" element={<GestaoHorarios />} />
              <Route path="/medico/pacientes" element={<ListaPacientes />} />
              <Route path="/medico/prontuarios" element={<ProntuariosMedico />} />
              <Route path="/medico/prontuario/:id" element={<ProntuarioPaciente />} />
              <Route path="/medico/perfil" element={<PerfilMedico />} />
              <Route path="/medico/assistente" element={<AssistenteVirtual />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
