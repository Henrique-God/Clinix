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
│   ├── ChatBotAPI/          → Assistente IA (OpenAI Sprint 3) (porta 5003)
│   └── Shared/              → Biblioteca compartilhada (JWT validation)
├── Frontend/                → React app                       (porta 3000)
├── docker-compose.yml
└── .env.example
```

## Pré-requisitos

- .NET 8 SDK
- Docker + Docker Compose
- Node.js 20+

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
| ChatBotAPI        | http://localhost:5003  | http://localhost:5003/swagger      |
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

### ChatBotAPI
```bash
cd Backend/ChatBotAPI
dotnet run
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

### ChatBotAPI (`/chatbot`)
| Método | Rota             | Auth | Descrição                     |
| ------ | ---------------- | ---- | ----------------------------- |
| POST   | /chatbot/message | JWT  | Enviar mensagem ao assistente |

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
docker build -f Backend/ChatBotAPI/Dockerfile -t clinix/chatbot-api .

# Remover container e imagem para rebuild limpo
docker stop <nome> && docker rm <nome> && docker rmi <imagem>

# Limpar cache de build
docker builder prune -f
```
