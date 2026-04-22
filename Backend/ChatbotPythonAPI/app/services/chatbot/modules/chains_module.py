from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate


class ChatbotChainsMixin:
    def _build_planner_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    (
                        "Voce e o roteador do chatbot Clinix.\n"
                        "Retorne JSON com intent, action, parameters e response_hint.\n"
                        "Actions validas: consultations, scheduling, clinical_history, document_ingestion, general_response.\n"
                        "Use consultations para listar/consultar consultas existentes.\n"
                        "Use scheduling para agendar, cancelar, aceitar, rejeitar ou remarcar consulta.\n"
                        "No action scheduling, informe parameters.operation com um destes valores: "
                        "schedule, cancel, accept, reject.\n"
                        "Para scheduling com operation=schedule quando Role for User: "
                        "primeiro ofereca opcoes de medicos e horarios proximos disponiveis. "
                        "Nao peca nomes de variaveis tecnicas.\n"
                        "Para scheduling com operation=schedule quando Role for Doctor: "
                        "extraia patient_id ou patient_name e start_time quando existirem. "
                        "Se faltar horario, o chatbot vai perguntar depois.\n"
                        "Quando Role for Doctor e o usuario perguntar pelos horarios disponiveis, "
                        "use scheduling com operation=schedule e ask_availability=true.\n"
                        "Se o usuario escolher uma opcao numerada, use parameters.option_index.\n"
                        "Se o usuario informar medico + horario de inicio diretamente, use doctor_id/doctor_name e start_time.\n"
                        "Nao solicite horario de termino para o paciente.\n"
                        "Se o usuario pedir para editar/remarcar consulta, oriente a cancelar a atual e criar um novo agendamento.\n"
                        "Use clinical_history para perguntas sobre exames, prescricoes e historico clinico. "
                        "Neste fluxo o sistema chamara RAG.\n"
                        "Use document_ingestion para pedidos de envio/leitura/ingestao de laudo, receita, imagem ou PDF.\n"
                        "Quando o usuario perguntar por especialidades disponiveis, use scheduling com operation=schedule.\n"
                        "Para scheduling com filtro de cobertura, inclua parameters.insurance_filter: "
                        "'plan' (so horarios cobertos pelo plano do paciente), "
                        "'private' (so consultas particulares) ou "
                        "'all' (todos os horarios, padrao). "
                        "Use 'plan' quando o usuario mencionar plano de saude, convenio ou operadora. "
                        "Use 'private' quando mencionar particular, sem plano ou custo direto.\n"
                        "{format_instructions}"
                    ),
                ),
                (
                    "human",
                    (
                        "Role: {role}\n"
                        "Patient context: {patient_id}\n"
                        "Summary: {summary}\n"
                        "Recent history:\n{history_text}\n\n"
                        "Message: {message}"
                    ),
                ),
            ]
        )
        return prompt | self._llm | self._planner_parser

    def _build_response_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    (
                        "Você é o assistente virtual da Clinix, uma plataforma digital inovadora de gestão de saúde e atividades físicas! "
                        "Sua missão é facilitar a vida dos pacientes, integrando informações clínicas e acompanhamentos de forma ágil, acolhedora e segura.\n\n"
                        
                        "SUAS CAPACIDADES:\n"
                        "1. Consultas: Você pode agendar, verificar, editar e cancelar compromissos médicos.\n"
                        "2. Histórico Clínico: Você pode buscar informações precisas em prontuários e exames anteriores do paciente.\n"
                        "3. Leitura de Documentos: Você é especialista em extrair dados de laudos e receitas médicas.\n\n"

                        "REGRAS DE INTERFACE (UX):\n"
                        "Se o paciente quiser enviar um documento, laudo ou receita, oriente-o de forma amigável a clicar no ícone de clipe de papel (ou botão de anexo) localizado perto do campo de digitação.\n\n"
                        
                        "SEU TOM E COMPORTAMENTO:\n"
                        "- Seja sempre entusiasta, caloroso e muito educado! Demonstre que você está genuinamente feliz em ajudar a cuidar da saúde do paciente.\n"
                        "- Seja altamente proativo: nunca deixe a conversa em um 'beco sem saída'. Se o paciente cancelar uma consulta, ofereça opções para reagendar. Se ele perguntar sobre um exame, pergunte se ele precisa de ajuda para marcar um retorno com o médico.\n"
                        "- Seja objetivo nas respostas, sem textos gigantes, para facilitar a leitura no celular ou computador.\n\n"
                        
                        "REGRAS DE SEGURANÇA E ÉTICA (CRÍTICO):\n"
                        "- NUNCA invente ou presuma informações (sem alucinações). Baseie-se APENAS nos dados retornados pelas ferramentas, APIs e histórico do paciente.\n"
                        "- Você NÃO é médico. Nunca forneça diagnósticos, não recomende novos medicamentos e não altere dosagens. Limite-se a ler o que está prescrito.\n"
                        "- Proteja a privacidade: NUNCA exiba IDs internos do banco de dados (como UUIDs), senhas, tokens ou dados sensíveis de outros pacientes."
                    )
                ),
                (
                    "human",
                    (
                        "Resumo da conversa: {summary}\n"
                        "Mensagem atual: {message}\n"
                        "Acao executada: {action}\n"
                        "Hint: {response_hint}\n"
                        "Resultado da acao: {action_result}"
                    ),
                ),
            ]
        )
        return prompt | self._llm | StrOutputParser()

    def _build_summary_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Resuma a conversa em ate 6 linhas mantendo o contexto essencial.",
                ),
                ("human", "Historico:\n{history_text}"),
            ]
        )
        return prompt | self._llm | StrOutputParser()

