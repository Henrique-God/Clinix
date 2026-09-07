# Clinix

## 1. Project context

Clinix is an AI-powered medical appointment management system developed as part of the Software Engineering Laboratory II (PCS3852) course at the Polytechnic School of the University of São Paulo (USP).

Contributors:

- Henrique Godoy - [@Henrique-God](https://github.com/Henrique-God)
- Guilherme Gomes - [@Guilhermetxgomes](https://github.com/Guilhermetxgomes)
- Nicholas Sasaki Ogata - [@nichoogata](https://github.com/nichoogata)
- Matheus Guidoni - [@Santos-Moura](https://github.com/Santos-Moura)

The project received a grade of 10, the highest grade in the class, after being evaluated by both the course professors and Visagio.

## 2. What the software does

Clinix centralizes the main workflows of a digital healthcare platform. The application supports patient and doctor registration, authentication, professional search, appointment management, consultation invitations, acceptance, rejection, cancellation, completion, and clinical record tracking.

Main features:

- Separate registration, login, and profiles for patients and doctors.
- Medical scheduling with availability, calendar blocks, and appointment views.
- Appointment flow through invitations, acceptance, rejection, cancellation, and completion.
- Digital clinical records with entries, documents, access permissions, and patient history.
- Clinical document upload and ingestion with OCR and RAG support.
- Premium subscription integration with Stripe.
- Strava integration and workout routines for wellness tracking.
- React web frontend for patient and doctor workflows.

One of the project's main differentiators is the integrated chatbot. It receives user messages, detects intent, queries internal services and database-backed data, and answers based on real system information such as appointments, scheduling data, and clinical history. The chatbot also includes conversational memory in PostgreSQL and uses RAG to answer questions about previously ingested clinical documents and records.

## 3. Microservices architecture

The project is organized as a monorepo with a frontend, independent APIs, and shared backend components.

```text
Clinix/
├── Backend/
│   ├── UsersAPI/            -> authentication, users, doctors, patients, clinical records, Stripe, and Strava
│   ├── AppointmentsAPI/     -> scheduling, availability, invitations, and appointment lifecycle
│   ├── ChatbotPythonAPI/    -> chatbot, OCR, RAG, OpenAI, LangChain/LangGraph, and conversation memory
│   └── Shared/              -> shared components, such as JWT validation
├── Frontend/                -> React web application
├── docker-compose.yml       -> local service orchestration
└── .env.example             -> expected environment variables
```

Main services:

| Service | Technology | Local port | Responsibility |
| --- | --- | --- | --- |
| UsersAPI | ASP.NET Core / .NET 8 | 5001 | Users, authentication, clinical records, subscriptions, and integrations |
| AppointmentsAPI | ASP.NET Core / .NET 8 | 5002 | Appointments, availability, and calendar |
| ChatbotPythonAPI | FastAPI / Python | 5003 | Chat, RAG, OCR, and AI integration |
| Frontend | React / Vite | 3000 | Product web interface |

The APIs communicate through internal HTTP calls, protected by JWT and internal service keys. Relational data is stored in PostgreSQL, separated by domain schemas, while the chatbot keeps a Chroma vector index for semantic retrieval over clinical documents.

## 4. How to run the project

Prerequisites:

- Docker and Docker Compose
- .NET 8 SDK, if running the APIs manually
- Node.js 20+, if running the frontend manually
- Python 3.12+, if running the chatbot manually

### Running everything with Docker Compose

From the project root:

```bash
cp .env.example .env
```

Fill the `.env` file with the required credentials and local configuration. Then run:

```bash
docker compose up --build
```

Local URLs:

| Service | URL | Documentation |
| --- | --- | --- |
| Frontend | http://localhost:3000 | - |
| UsersAPI | http://localhost:5001 | http://localhost:5001/swagger |
| AppointmentsAPI | http://localhost:5002 | http://localhost:5002/swagger |
| ChatbotPythonAPI | http://localhost:5003 | http://localhost:5003/docs |

To stop the services:

```bash
docker compose down
```

### Running services individually

UsersAPI:

```bash
cd Backend/UsersAPI
dotnet run
```

AppointmentsAPI:

```bash
cd Backend/AppointmentsAPI
dotnet run
```

ChatbotPythonAPI:

```bash
cd Backend/ChatbotPythonAPI
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5003
```

Frontend:

```bash
cd Frontend
npm install
npm run dev
```

Before using the APIs with a real database, configure `DB_CONNECTION` in `.env` and apply the required migrations for the .NET services.
