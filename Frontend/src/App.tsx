import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import CadastroPaciente from "./pages/CadastroPaciente";
import CadastroMedico from "./pages/CadastroMedico";

// Agendamento
import SelecionarEspecialidade from "./pages/agendamento/SelecionarEspecialidade";
import SelecionarMedico from "./pages/agendamento/SelecionarMedico";
import SelecionarDataHora from "./pages/agendamento/SelecionarDataHora";
import ConfirmacaoAgendamento from "./pages/agendamento/ConfirmacaoAgendamento";

// Paciente
import MinhasConsultas from "./pages/paciente/MinhasConsultas";
import Prontuario from "./pages/paciente/Prontuario";
import AssistenteVirtual from "./pages/paciente/AssistenteVirtual";

// Médico
import PainelMedico from "./pages/medico/PainelMedico";
import GestaoHorarios from "./pages/medico/GestaoHorarios";
import ListaPacientes from "./pages/medico/ListaPacientes";
import ProntuarioPaciente from "./pages/medico/ProntuarioPaciente";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/" element={<Login />} />
          <Route path="/cadastro/paciente" element={<CadastroPaciente />} />
          <Route path="/cadastro/medico" element={<CadastroMedico />} />

          {/* Agendamento */}
          <Route path="/agendar/especialidade" element={<SelecionarEspecialidade />} />
          <Route path="/agendar/medico" element={<SelecionarMedico />} />
          <Route path="/agendar/data-hora" element={<SelecionarDataHora />} />
          <Route path="/agendar/confirmacao" element={<ConfirmacaoAgendamento />} />

          {/* Paciente */}
          <Route path="/paciente/consultas" element={<MinhasConsultas />} />
          <Route path="/paciente/prontuario" element={<Prontuario />} />
          <Route path="/paciente/assistente" element={<AssistenteVirtual />} />

          {/* Médico */}
          <Route path="/medico/painel" element={<PainelMedico />} />
          <Route path="/medico/horarios" element={<GestaoHorarios />} />
          <Route path="/medico/pacientes" element={<ListaPacientes />} />
          <Route path="/medico/prontuarios" element={<ListaPacientes />} />
          <Route path="/medico/prontuario/:id" element={<ProntuarioPaciente />} />
          <Route path="/medico/assistente" element={<AssistenteVirtual />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
