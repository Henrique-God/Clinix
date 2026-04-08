import { useMemo, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { chatbotApi } from "@/lib/api/clinix-api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const patientSuggestions = [
  "Quais consultas eu tenho esta semana?",
  "Como esta meu historico clinico?",
  "Quero entender meus documentos recentes.",
];

const doctorSuggestions = [
  "Quais consultas tenho hoje?",
  "Resuma minha agenda da semana.",
  "Me lembre dos pacientes pendentes.",
];

export default function AssistenteVirtual() {
  const { session, profile } = useAuth();
  const isDoctor = session?.userType === "Doctor";
  const Layout = isDoctor ? DoctorLayout : PatientLayout;
  const suggestions = isDoctor ? doctorSuggestions : patientSuggestions;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-message",
      content: isDoctor
        ? "Ola, posso ajudar com sua agenda, seus pacientes e rotinas clinicas."
        : "Ola, posso ajudar com suas consultas, seu historico clinico e seus documentos.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return chatbotApi.sendMessage(session!.token, {
        message,
        patient_id: session?.userType === "User" ? profile?.userId : undefined,
        conversation_id: conversationId,
      });
    },
    onSuccess: (response) => {
      const nextConversationId =
        typeof response.metadata?.conversation_id === "string"
          ? response.metadata.conversation_id
          : conversationId;

      if (nextConversationId) {
        setConversationId(nextConversationId);
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `bot-${Date.now()}`,
          content: response.reply,
          sender: "bot",
          timestamp: new Date(response.timestamp),
        },
      ]);
    },
    onError: () => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `bot-error-${Date.now()}`,
          content:
            "Nao consegui responder agora. Tente novamente em alguns instantes.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const headerText = useMemo(
    () =>
      isDoctor
        ? "Assistente Clinix para medicos"
        : "Assistente Clinix para pacientes",
    [isDoctor],
  );

  function handleSend() {
    const trimmedInput = input.trim();
    if (!trimmedInput || chatMutation.isPending) {
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        content: trimmedInput,
        sender: "user",
        timestamp: new Date(),
      },
    ]);
    setInput("");
    chatMutation.mutate(trimmedInput);
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-12rem)] flex flex-col animate-slide-up">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">{headerText}</h2>
                <p className="text-sm text-muted-foreground">
                  {chatMutation.isPending ? "Respondendo..." : "Online"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3", message.sender === "user" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    message.sender === "bot" ? "bg-primary/10" : "bg-secondary",
                  )}
                >
                  {message.sender === "bot" ? (
                    <Bot className="w-4 h-4 text-primary" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    message.sender === "bot"
                      ? "bg-secondary text-foreground rounded-tl-none"
                      : "bg-primary text-primary-foreground rounded-tr-none",
                  )}
                >
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          {messages.length === 1 ? (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2">Sugestoes:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full text-sm transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="p-4 border-t border-border">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 input-focus"
                disabled={chatMutation.isPending}
              />
              <Button type="submit" size="icon" disabled={chatMutation.isPending || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
