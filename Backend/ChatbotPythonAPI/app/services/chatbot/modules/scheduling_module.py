from __future__ import annotations

from .scheduling_context_module import ChatbotSchedulingContextModule
from .scheduling_flow_module import ChatbotSchedulingFlowModule
from .scheduling_parsing_module import ChatbotSchedulingParsingModule
from .scheduling_payload_module import ChatbotSchedulingPayloadModule


class ChatbotSchedulingMixin(
    ChatbotSchedulingFlowModule,
    ChatbotSchedulingContextModule,
    ChatbotSchedulingPayloadModule,
    ChatbotSchedulingParsingModule,
):
    pass
