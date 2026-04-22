# ChatbotPythonAPI

Microservico Python para assistente virtual Clinix com:

- FastAPI para endpoints de chat, ingestao de documentos e RAG
- Orquestracao do chat com LangGraph + LangChain (roteamento por dominio: consultas, agendamentos, historico clinico, ingestao documental, geral)
- Memoria persistente de conversas por `conversation_id` (PostgreSQL)
- Integracao com `AppointmentsAPI` para operacoes de consulta/agendamento/cancelamento
- Integracao com `UsersAPI` para salvar entradas/documentos do prontuario (arquivo fica no S3 via UsersAPI)
- Chunking com LangChain (`RecursiveCharacterTextSplitter`)
- Embeddings open-source com `sentence-transformers`
- ChromaDB para busca vetorial
- LLM/OCR via OpenAI
- RAG acionado apenas no fluxo de historico clinico (endpoint separado e uso sob demanda)

## Variaveis de ambiente

- `JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `JWT_ALLOWED_ALGORITHMS` (opcional, padrao: `HS512,HS384,HS256`)
- `APPOINTMENTS_API_BASE_URL`
- `USERS_API_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (opcional; padrao `https://api.openai.com/v1`)
- `OPENAI_TEXT_MODEL` (opcional; padrao `gpt-4o-mini`)
- `OPENAI_VISION_MODEL` (opcional; padrao `gpt-4o`)
- `OPENAI_REQUEST_TIMEOUT_SECONDS` (opcional; padrao `120`)
- `LANGFUSE_ENABLED` (opcional; padrao `true`)
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (opcional; padrao `https://cloud.langfuse.com`)
- `LANGFUSE_TRACING_ENVIRONMENT` (opcional; padrao `development`)
- `LANGFUSE_TRACING_ENABLED` (opcional; padrao `true`)
- `CHROMA_PERSIST_PATH`
- `CHROMA_COLLECTION_NAME`
- `EMBEDDING_MODEL_NAME`
- `CHAT_MEMORY_POSTGRES_DSN` (ou `DB_CONNECTION`, mesmo padrao das APIs C#)
- `CHAT_MEMORY_SCHEMA` (default: `chatbot`)
- `CHAT_MEMORY_WINDOW_MESSAGES`

## Tracing com Langfuse

Com as variaveis `LANGFUSE_*` configuradas, o endpoint `POST /chatbot/message` passa a enviar traces do fluxo do chatbot (roteamento, resposta e resumo) para o projeto no Langfuse (us.cloud.langfuse.com).

## Executar local

```powershell
cd Backend/ChatbotPythonAPI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5003
```

## Contrato de chat

`POST /chatbot/message`

Body exemplo:

```json
{
  "message": "Quais consultas eu tenho esta semana?",
  "patient_id": "00000000-0000-0000-0000-000000000000",
  "conversation_id": "11111111-1111-1111-1111-111111111111"
}
```

Se `conversation_id` nao for enviado, o servico cria um novo id e devolve no campo `metadata.conversation_id`.

## Autenticacao no Swagger

Nos endpoints protegidos, use o botao `Authorize` do Swagger e cole apenas o JWT.
Nao inclua o prefixo `Bearer ` manualmente no campo, porque a UI ja envia esse prefixo automaticamente.
