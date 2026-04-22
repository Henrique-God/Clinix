from __future__ import annotations

from ..definitions import ChatGraphState


class ChatbotActionNodesMixin:
    async def _load_memory_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        conversation_id = self._memory_store.resolve_conversation_id(state.get("conversation_id"))
        patient_id = state.get("patient_id") or actor.user_id
        self._memory_store.ensure_conversation(
            conversation_id=conversation_id,
            user_id=actor.user_id,
            patient_id=patient_id,
        )
        history = self._memory_store.get_history(conversation_id, self._history_window)
        summary = self._memory_store.get_summary(conversation_id)

        return {
            "conversation_id": conversation_id,
            "patient_id": patient_id,
            "history": history,
            "summary": summary,
        }

    async def _consultations_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]

        if self._is_doctor_role(actor.role):
            appointments = await self._appointments_client.get_doctor_appointments(actor.token)
        elif self._is_patient_role(actor.role):
            appointments = await self._appointments_client.get_patient_appointments(actor.token)
        else:
            return {"action_result": {"error": "Somente medicos e pacientes podem consultar agenda."}}

        return {"action_result": {"count": len(appointments), "appointments": appointments[:6]}}

    async def _clinical_history_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        patient_id = str(state.get("patient_id") or actor.user_id)
        rag = await self._rag_service.ask(
            token=actor.token,
            patient_id=patient_id,
            query=state["message"],
        )

        return {"action_result": {"rag": rag, "patient_id": patient_id}}

    async def _document_ingestion_node(self, state: ChatGraphState) -> ChatGraphState:
        return {
            "action_result": {
                "flow": "document_ingestion",
                "message": (
                    "Para me enviar uma receita médica ou um laudo do seu exame, é muito simples!"
                    "Basta clicar no ícone de clipe de papel, ao lado do campo de mensagem, e selecionar o arquivo que deseja me enviar."
                    "Assim que você mandar, eu vou ler o documento automaticamente, guardar as informações importantes no seu histórico e você já poderá me fazer perguntas sobre ele!"
                    "Se tiver alguma dúvida ou precisar de ajuda, é só me chamar."
                ),
            }
        }

    async def _general_response_node(self, state: ChatGraphState) -> ChatGraphState:
        return {"action_result": {"status": "general"}}

    async def _compose_reply_node(self, state: ChatGraphState) -> ChatGraphState:
        plan = state.get("plan", {})
        action = str(plan.get("action", "general_response"))
        action_result = state.get("action_result", {})

        if "error" in action_result:
            return {"reply": str(action_result["error"])}

        if action == "clinical_history":
            rag_data = action_result.get("rag", {})
            answer = str(rag_data.get("answer", "")).strip()

            if answer:
                return {"reply": answer}
            
            return {"reply": "Nao encontrei dados suficientes no historico clinico."}

        if action == "document_ingestion":
            return {"reply": str(action_result.get("message", "Use /documents/ingest para enviar documentos."))}

        if action == "scheduling" and action_result.get("message"):
            return {"reply": str(action_result["message"])}

        try:
            reply = await self._response_chain.ainvoke(
                {
                    "summary": state.get("summary", ""),
                    "message": state["message"],
                    "action": action,
                    "response_hint": plan.get("response_hint", ""),
                    "action_result": str(action_result),
                },
                config=state.get("invoke_config"),
            )
            return {"reply": reply}
        
        except Exception:
            return {"reply": "Nao consegui responder agora. Tente novamente em instantes."}

    async def _save_memory_node(self, state: ChatGraphState) -> ChatGraphState:
        conversation_id = state["conversation_id"]
        self._memory_store.append_message(conversation_id, "user", state["message"])
        self._memory_store.append_message(conversation_id, "assistant", state.get("reply", ""))

        history = self._memory_store.get_history(conversation_id, self._history_window)

        if len(history) >= self._history_window:
            history_text = self._format_history(history)
            try:
                summary = await self._summary_chain.ainvoke(
                    {"history_text": history_text},
                    config=state.get("invoke_config"),
                )
                self._memory_store.update_summary(conversation_id, summary)
            except Exception:
                pass

        return state

