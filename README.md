# Clinix — Plataforma de Saúde (Microsserviços)

## Resumo pra rodar (Matheus)

No diretório raiz:

```bash
cp .env.example .env
```

Altere o .env com seus respectivos valores, depois só rodar:

```bash
docker-compose up --build
```

## Arquitetura

```
Clinix/
├── Backend/
│   ├── UsersAPI/            → Autenticação JWT + Prontuários  (porta 5001)
│   ├── AppointmentsAPI/     → Agendamentos                   (porta 5002)
│   ├── ChatbotPythonAPI/    → Assistente IA (RAG + OCR + OpenAI) (porta 5003)
│   └── Shared/              → Biblioteca compartilhada (JWT validation)
├── Frontend/                → React app                       (porta 3000)
├── docker-compose.yml
└── .env.example
```

## Pré-requisitos

- .NET 8 SDK
- Docker + Docker Compose
- Node.js 20+
- Python 3.12+

---

## Executar com Docker Compose (todos os serviços)

```bash
# 1. Copie e preencha as variáveis de ambiente
cp .env.example .env

# 2. Suba todos os serviços
docker compose up --build

# 3. Para derrubar
docker compose down
```

| Serviço           | URL local              | Swagger                           |
| ----------------- | ---------------------- | --------------------------------- |
| UsersAPI          | http://localhost:5001  | http://localhost:5001/swagger      |
| AppointmentsAPI   | http://localhost:5002  | http://localhost:5002/swagger      |
| ChatbotPythonAPI  | http://localhost:5003  | http://localhost:5003/docs         |
| Frontend          | http://localhost:3000  | —                                 |

---

## Executar serviços individualmente (desenvolvimento)

### UsersAPI
```bash
cd Backend/UsersAPI
dotnet run
# Disponível em http://localhost:5001
```

### AppointmentsAPI
```bash
cd Backend/AppointmentsAPI
dotnet run
# Disponível em http://localhost:5002
```

### ChatbotPythonAPI
```bash
cd Backend/ChatbotPythonAPI
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5003
# Disponível em http://localhost:5003
```

### Frontend
```bash
cd Frontend
npm install
npm run dev
# Disponível em http://localhost:3000
```

---

## Endpoints principais

### UsersAPI (`/auth`)
| Método | Rota           | Auth | Descrição              |
| ------ | -------------- | ---- | ---------------------- |
| POST   | /auth/login    | —    | Login (retorna JWT)    |
| POST   | /auth/register | —    | Cadastro de usuário    |
| GET    | /auth/me       | JWT  | Dados do usuário atual |

### UsersAPI (`/clinical-records`)
| Método | Rota              | Auth | Descrição          |
| ------ | ----------------- | ---- | ------------------ |
| GET    | /clinical-records | JWT  | Listar prontuários |
| POST   | /clinical-records | JWT  | Criar prontuário   |

### AppointmentsAPI (`/appointments`)
| Método | Rota                 | Auth | Descrição        |
| ------ | -------------------- | ---- | ---------------- |
| GET    | /appointments/health | —    | Health check     |
| GET    | /appointments        | JWT  | Listar consultas |
| POST   | /appointments        | JWT  | Agendar consulta |

### ChatbotPythonAPI
| Método | Rota             | Auth | Descrição                     |
| ------ | ---------------- | ---- | ----------------------------- |
| POST   | /chatbot/message | JWT  | Enviar mensagem ao assistente |
| POST   | /documents/ingest | JWT | Ingerir PDF/imagem e indexar no RAG |
| GET    | /documents/{id}/status | JWT | Consultar status da ingestão |
| POST   | /rag/query | JWT | Consulta semântica do histórico |

---

## Banco de Dados (AWS RDS PostgreSQL)

Todos os serviços SQL usam o mesmo RDS, separados por **schema**:

```sql
-- Executar no RDS antes de rodar as migrations
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS appointments;
GRANT ALL ON SCHEMA users        TO clinix_app;
GRANT ALL ON SCHEMA appointments TO clinix_app;
```

### Aplicar migrations

```bash
# UsersAPI
cd Backend/UsersAPI
dotnet ef database update

# AppointmentsAPI
cd Backend/AppointmentsAPI
dotnet ef database update
```

---

## Build Docker individual

```bash
# Build a partir da raiz do projeto (necessário para o contexto de build)
docker build -f Backend/UsersAPI/Dockerfile -t clinix/users-api .
docker build -f Backend/AppointmentsAPI/Dockerfile -t clinix/appointments-api .
docker build -f Backend/ChatbotPythonAPI/Dockerfile -t clinix/chatbot-api .

# Remover container e imagem para rebuild limpo
docker stop <nome> && docker rm <nome> && docker rmi <imagem>

# Limpar cache de build
docker builder prune -f
```

---

## Contexto funcional consolidado (produto)

Este projeto (Clinix) cobre gestao de agenda medica/paciente e evolucao para prontuario digital e wellness premium.

### Dominios e casos de uso

1. Dominio A - Gestao de Acesso e Perfis
- UC1: Cadastro de Pacientes
- UC2: Cadastro de Medicos com especialidades

2. Dominio B - Agendamento Inteligente
- UC3: Cadastro de horarios disponiveis pelo profissional
- UC4: Agendamento de consulta pelo paciente
- UC5: Agendamento via chatbot
- UC6: Visualizacao e gerenciamento de consultas (lista/calendario, proximas/concluidas)

3. Dominio C - Prontuario Clinico Digital
- UC7: Cadastro de receitas e pedidos
- UC8: Cadastro de exames/laudos
- UC9: Visualizacao de historico clinico unificado
- UC10: Extracao de dados de documentos por IA (desafio adicional)

4. Dominio D - Wellness e Monetizacao (Premium)
- UC11: Integracao com Strava para acompanhamento multiprofissional
- UC12: Cadastro de rotinas de treino (usuarios pagantes)

### Regras funcionais gerais (transversais)

- Recriar validacoes/regras/triggers legadas, exceto excecoes explicitas nas US.
- Aplicar permissionamento por perfil (detalhes na planilha de acessos/permissoes).
- Manter foco em fluxos simples e objetivos para reduzir friccao de uso.

### Escopo inicial para evolucao da UsersAPI

- Cadastro e autenticacao de pacientes e medicos (UC1 e UC2).
- Base de prontuario clinico (UC7, UC8, UC9) com historico rastreavel.
- Preparacao para integracao com AppointmentsAPI e ChatbotPythonAPI (UC3-UC6).
- Estruturar fundacoes de autorizacao por papel e validacoes de dominio.

Referencia tecnica detalhada para continuidade: `Backend/UsersAPI/TECH_CONTEXT.md`.
