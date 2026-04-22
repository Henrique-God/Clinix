from __future__ import annotations

from ..graph_builder import build_chatbot_graph


class ChatbotGraphMixin:
    def _build_graph(self):
        return build_chatbot_graph(self)
