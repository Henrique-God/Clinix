# Screen Coverage Audit

## Context

This file tracks frontend screen coverage against the consolidated use cases in the project root `README.md`.

Backend remains the source of truth. Coverage below only counts flows that are backed by currently available endpoints.

## Coverage by use case

### UC1 - Cadastro de Pacientes
- Covered by [CadastroPaciente](./src/pages/CadastroPaciente.tsx)
- Backend-aligned fields: `name`, `email`, `password`

### UC2 - Cadastro de Medicos com especialidades
- Covered by [CadastroMedico](./src/pages/CadastroMedico.tsx)
- Backend-aligned fields: `name`, `professionalRegister`, `specialties`, `email`, `phone`, `password`

### UC3 - Cadastro de horarios disponiveis pelo profissional
- Covered by [GestaoHorarios](./src/pages/medico/GestaoHorarios.tsx)

### UC4 - Agendamento de consulta pelo paciente
- Covered by:
  - [SelecionarEspecialidade](./src/pages/agendamento/SelecionarEspecialidade.tsx)
  - [SelecionarMedico](./src/pages/agendamento/SelecionarMedico.tsx)
  - [SelecionarDataHora](./src/pages/agendamento/SelecionarDataHora.tsx)
  - [ConfirmacaoAgendamento](./src/pages/agendamento/ConfirmacaoAgendamento.tsx)

### UC5 - Agendamento via chatbot
- Covered by [AssistenteVirtual](./src/pages/paciente/AssistenteVirtual.tsx)
- Depends on chatbot orchestration for the final backend action

### UC6 - Visualizacao e gerenciamento de consultas
- Patient coverage:
  - [MinhasConsultas](./src/pages/paciente/MinhasConsultas.tsx)
- Doctor coverage:
  - [PainelMedico](./src/pages/medico/PainelMedico.tsx)

### UC7 - Cadastro de receitas e pedidos
- Covered generically through clinical record entries and documents:
  - [ProntuarioPaciente](./src/pages/medico/ProntuarioPaciente.tsx)
  - [DocumentosClinicos](./src/pages/paciente/DocumentosClinicos.tsx)
- Note: the backend currently models this as generic clinical entries/documents, not as structured prescription/order resources

### UC8 - Cadastro de exames/laudos
- Covered by document upload, listing and download:
  - [DocumentosClinicos](./src/pages/paciente/DocumentosClinicos.tsx)
  - [ProntuarioPaciente](./src/pages/medico/ProntuarioPaciente.tsx)
  - [Prontuario](./src/pages/paciente/Prontuario.tsx)

### UC9 - Visualizacao de historico clinico unificado
- Patient coverage:
  - [Prontuario](./src/pages/paciente/Prontuario.tsx)
- Doctor coverage:
  - [ProntuariosMedico](./src/pages/medico/ProntuariosMedico.tsx)
  - [ProntuarioPaciente](./src/pages/medico/ProntuarioPaciente.tsx)

### UC10 - Extracao de dados de documentos por IA
- Covered by [DocumentosClinicos](./src/pages/paciente/DocumentosClinicos.tsx)
- Includes:
  - document ingestion trigger
  - ingestion status follow-up
  - structured result display
  - direct RAG query against indexed history

### UC11 - Integracao com Strava
- Not covered
- No backend endpoints available in the current project scope

### UC12 - Cadastro de rotinas de treino
- Not covered
- No backend endpoints available in the current project scope

## Screens added or corrected in this phase

- Added [DocumentosClinicos](./src/pages/paciente/DocumentosClinicos.tsx)
- Added [ProntuariosMedico](./src/pages/medico/ProntuariosMedico.tsx)
- Corrected patient registration to match backend contract
- Added doctor document upload flow inside [ProntuarioPaciente](./src/pages/medico/ProntuarioPaciente.tsx)
- Updated frontend branding to `Clinix`

## Remaining product gaps

- Patient profile enrichment fields such as CPF, birth date and insurance are still not persisted because the current auth backend does not expose those fields.
- Structured resources for prescriptions and exam orders do not exist yet; they are represented as generic clinical entries/documents.
- Wellness and premium modules remain outside the currently implemented backend scope.
