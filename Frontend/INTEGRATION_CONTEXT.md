# Frontend Integration Context

## Objective
Base de contratos e integracoes para substituir os mocks do frontend do Clinix por dados reais.

## APIs consumidas pelo frontend

### UsersAPI
- `POST /auth/login`
- `POST /auth/patients/register`
- `POST /auth/doctors/register`
- `GET /auth/me`
- `GET /directory/doctors`
- `GET /directory/users/{userId}`
- `GET /patients/{patientId}/clinical-record`
- `GET /patients/{patientId}/clinical-record/entries`
- `POST /patients/{patientId}/clinical-record/entries`
- `PUT /patients/{patientId}/clinical-record/entries/{entryId}`
- `DELETE /patients/{patientId}/clinical-record/entries/{entryId}`
- `POST /patients/{patientId}/clinical-record/entries/{entryId}/documents`
- `GET /patients/{patientId}/clinical-record/access-grants`
- `POST /patients/{patientId}/clinical-record/access-grants`
- `PATCH /patients/{patientId}/clinical-record/access-grants/{grantId}/revoke`

### AppointmentsAPI
- `GET /appointments/patient`
- `GET /appointments/doctor`
- `GET /appointments/{appointmentId}`
- `POST /appointments/invite`
- `POST /appointments/{appointmentId}/accept`
- `POST /appointments/{appointmentId}/reject`
- `POST /appointments/{appointmentId}/cancel`
- `POST /appointments/{appointmentId}/complete`
- `GET /doctors/{doctorId}/available-slots`
- `GET /doctors/{doctorId}/availability`
- `POST /doctors/{doctorId}/availability`
- `PUT /availability/{availabilityId}`
- `DELETE /availability/{availabilityId}`
- `GET /doctors/{doctorId}/calendar`
- `POST /doctors/{doctorId}/calendar-events`
- `PUT /calendar-events/{eventId}`
- `DELETE /calendar-events/{eventId}`

### ChatbotPythonAPI
- `POST /chatbot/message`
- `POST /documents/ingest`
- `GET /documents/{ingestionId}/status`
- `POST /rag/query`

## Screen-to-endpoint map

### Auth
- `Login.tsx` -> `POST /auth/login`, `GET /auth/me`
- `CadastroPaciente.tsx` -> `POST /auth/patients/register`
- `CadastroMedico.tsx` -> `POST /auth/doctors/register`

### Agendamento paciente
- `SelecionarEspecialidade.tsx` -> especialidades derivadas de `GET /directory/doctors`
- `SelecionarMedico.tsx` -> `GET /directory/doctors?specialty=...`
- `SelecionarDataHora.tsx` -> `GET /doctors/{doctorId}/available-slots`
- `ConfirmacaoAgendamento.tsx` -> `POST /appointments/invite`

### Area do paciente
- `MinhasConsultas.tsx` -> `GET /appointments/patient`
- `Prontuario.tsx` -> `GET /patients/{patientId}/clinical-record`, `GET /patients/{patientId}/clinical-record/entries`
- `AssistenteVirtual.tsx` -> `POST /chatbot/message`

### Area do medico
- `PainelMedico.tsx` -> `GET /appointments/doctor`, `GET /doctors/{doctorId}/calendar`, `GET /directory/users/{patientId}`
- `GestaoHorarios.tsx` -> `GET /doctors/{doctorId}/availability`, `POST /doctors/{doctorId}/availability`, `DELETE /availability/{availabilityId}`
- `ListaPacientes.tsx` -> `GET /appointments/doctor` + resolucao de pacientes via `GET /directory/users/{patientId}`
- `ProntuarioPaciente.tsx` -> `GET /patients/{patientId}/clinical-record`, `GET /patients/{patientId}/clinical-record/entries`, `POST /patients/{patientId}/clinical-record/entries`

## Missing contracts solved in this step
- `GET /directory/doctors`: necessario para busca/listagem de medicos por especialidade.
- `GET /directory/users/{userId}`: necessario para resolver nomes e metadados basicos a partir dos ids retornados por agendamentos e prontuario.
- `GET /auth/me` enriquecido: agora pode devolver nome, tipo, status e dados profissionais do medico quando disponiveis.
- CORS habilitado em `UsersAPI`, `AppointmentsAPI` e `ChatbotPythonAPI` para permitir consumo direto do browser.
