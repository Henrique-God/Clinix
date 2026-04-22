from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from .definitions import ChatGraphState


def build_chatbot_graph(service: Any):
    graph = StateGraph(ChatGraphState)
    graph.add_node("load_memory", service._load_memory_node)
    graph.add_node("plan_step", service._plan_node)
    graph.add_node("route_action", service._route_action_node)
    graph.add_node("consultations", service._consultations_node)
    graph.add_node("scheduling_prepare", service._scheduling_prepare_node)
    graph.add_node("scheduling_ask_specialty", service._scheduling_ask_specialty_node)
    graph.add_node("scheduling_show_options", service._scheduling_show_options_node)
    graph.add_node("scheduling_create", service._scheduling_create_node)
    graph.add_node("clinical_history", service._clinical_history_node)
    graph.add_node("document_ingestion", service._document_ingestion_node)
    graph.add_node("general_response", service._general_response_node)
    graph.add_node("compose_reply", service._compose_reply_node)
    graph.add_node("save_memory", service._save_memory_node)

    graph.add_edge(START, "load_memory")
    graph.add_edge("load_memory", "plan_step")
    graph.add_edge("plan_step", "route_action")
    graph.add_conditional_edges(
        "route_action",
        service._route_action,
        {
            "consultations": "consultations",
            "scheduling": "scheduling_prepare",
            "clinical_history": "clinical_history",
            "document_ingestion": "document_ingestion",
            "general_response": "general_response",
        },
    )
    graph.add_edge("consultations", "compose_reply")
    graph.add_conditional_edges(
        "scheduling_prepare",
        service._route_scheduling_step,
        {
            "ask_specialty": "scheduling_ask_specialty",
            "show_options": "scheduling_show_options",
            "create": "scheduling_create",
            "compose_reply": "compose_reply",
        },
    )
    graph.add_edge("scheduling_ask_specialty", "compose_reply")
    graph.add_conditional_edges(
        "scheduling_show_options",
        service._route_scheduling_step,
        {
            "create": "scheduling_create",
            "compose_reply": "compose_reply",
        },
    )
    graph.add_edge("scheduling_create", "compose_reply")
    graph.add_edge("clinical_history", "compose_reply")
    graph.add_edge("document_ingestion", "compose_reply")
    graph.add_edge("general_response", "compose_reply")
    graph.add_edge("compose_reply", "save_memory")
    graph.add_edge("save_memory", END)
    return graph.compile()
