import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, RotateCcw, Send, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { chatbotApi } from "@/lib/api/clinix-api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface PersistedMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: string;
}

interface PersistedConversationState {
  conversationId?: string;
  messages: PersistedMessage[];
}

const patientSuggestions = [
  "Quais consultas eu tenho esta semana?",
  "Como está meu histórico clínico?",
  "Quero entender meus documentos recentes.",
];

const doctorSuggestions = [
  "Quais consultas tenho hoje?",
  "Resuma minha agenda da semana.",
  "Me lembre dos pacientes pendentes.",
];

const chatStoragePrefix = "clinix.chatbot.conversation";

function createInitialMessage(isDoctor: boolean): Message {
  return {
    id: "initial-message",
    content: isDoctor
      ? "Olá, posso ajudar com sua agenda, seus pacientes e suas rotinas clínicas."
      : "Olá, posso ajudar com suas consultas, seu histórico clínico e seus documentos.",
    sender: "bot",
    timestamp: new Date(),
  };
}

function parsePersistedState(
  rawValue: string | null,
): PersistedConversationState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PersistedConversationState;
    const parsedMessages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (item): item is PersistedMessage =>
            typeof item?.id === "string" &&
            typeof item?.content === "string" &&
            (item?.sender === "user" || item?.sender === "bot") &&
            typeof item?.timestamp === "string",
        )
      : [];

    if (parsedMessages.length === 0) {
      return null;
    }

    return {
      conversationId:
        typeof parsed.conversationId === "string" ? parsed.conversationId : undefined,
      messages: parsedMessages,
    };
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string) {
  const pattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`inline-code-${index}`}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`em-${index}`}>{part.slice(1, -1)}</em>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={`link-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}

function renderMarkdown(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let blockKey = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }

      blocks.push(
        <pre
          key={`code-${blockKey++}`}
          className="overflow-x-auto rounded-md bg-black/10 p-3 font-mono text-xs"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${blockKey++}`} className="list-disc pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${blockKey++}`} className="list-decimal pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClass =
        level <= 2 ? "text-base font-semibold" : level <= 4 ? "font-semibold" : "font-medium";

      blocks.push(
        <p key={`heading-${blockKey++}`} className={headingClass}>
          {renderInlineMarkdown(headingText)}
        </p>,
      );
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s+|```|[-*]\s+|\d+\.\s+)/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed">
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-2 text-sm">{blocks}</div>;
}

export default function AssistenteVirtual() {
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const isDoctor = session?.userType === "Doctor";
  const Layout = isDoctor ? DoctorLayout : PatientLayout;
  const suggestions = isDoctor ? doctorSuggestions : patientSuggestions;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const initialMessage = useMemo(() => createInitialMessage(isDoctor), [isDoctor]);
  const chatStorageKey = useMemo(() => {
    if (!session?.userType || !profile?.userId) {
      return null;
    }

    return `${chatStoragePrefix}.${session.userType}.${profile.userId}`;
  }, [profile?.userId, session?.userType]);

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!chatStorageKey) {
      setMessages([initialMessage]);
      setConversationId(undefined);
      setIsHydrated(false);
      return;
    }

    setIsHydrated(false);

    const persistedState = parsePersistedState(window.localStorage.getItem(chatStorageKey));

    if (!persistedState) {
      setMessages([initialMessage]);
      setConversationId(undefined);
      setIsHydrated(true);
      return;
    }

    setMessages(
      persistedState.messages.map((message) => {
        const parsedTimestamp = new Date(message.timestamp);

        return {
          id: message.id,
          content: message.content,
          sender: message.sender,
          timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp,
        };
      }),
    );
    setConversationId(persistedState.conversationId);
    setIsHydrated(true);
  }, [chatStorageKey, initialMessage]);

  useEffect(() => {
    if (typeof window === "undefined" || !chatStorageKey || !isHydrated) {
      return;
    }

    const payload: PersistedConversationState = {
      conversationId,
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        sender: message.sender,
        timestamp: Number.isNaN(message.timestamp.getTime())
          ? new Date().toISOString()
          : message.timestamp.toISOString(),
      })),
    };

    window.localStorage.setItem(chatStorageKey, JSON.stringify(payload));
  }, [chatStorageKey, conversationId, isHydrated, messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) =>
      chatbotApi.sendMessage(session!.token, {
        message,
        patient_id: session?.userType === "User" ? profile?.userId : undefined,
        conversation_id: conversationId,
        patient_insurance_plan: session?.userType === "User" ? (profile?.healthInsurance ?? null) : null,
      }),
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
          content: "Não consegui responder agora. Tente novamente em alguns instantes.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (session?.userType !== "User" || !profile?.userId) {
        throw new Error("Upload de documentos disponível apenas para pacientes.");
      }

      return chatbotApi.ingestDocument(session.token, {
        file,
        patientId: profile.userId,
      });
    },
    onSuccess: (response, file) => {
      toast({
        title: "Upload iniciado",
        description: `Documento "${file.name}" enviado para processamento no chatbot.`,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `bot-upload-${Date.now()}`,
          content:
            `Recebi o documento "${file.name}". A ingestão foi iniciada com id ` +
            `${response.ingestion_id}. Você pode continuar conversando enquanto processo o arquivo.`,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error) => {
      toast({
        title: "Não foi possível enviar o documento",
        description:
          error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const headerText = useMemo(
    () =>
      isDoctor
        ? "Assistente Clinix para médicos"
        : "Assistente Clinix para pacientes",
    [isDoctor],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatMutation.isPending]);

  function handleFilePickerOpen() {
    fileInputRef.current?.click();
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || uploadMutation.isPending) {
      return;
    }

    uploadMutation.mutate(file);
  }

  function handleSend() {
    const trimmedInput = input.trim();
    if (!trimmedInput || chatMutation.isPending || uploadMutation.isPending) {
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

  function handleResetChat() {
    if (chatMutation.isPending || uploadMutation.isPending) {
      return;
    }

    setMessages([createInitialMessage(isDoctor)]);
    setConversationId(undefined);
    setInput("");

    if (typeof window !== "undefined" && chatStorageKey) {
      window.localStorage.removeItem(chatStorageKey);
    }

    toast({
      title: "Chat reiniciado",
      description: "Pronto. O assistente vai iniciar uma nova conversa sem contexto anterior.",
    });
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-12rem)] flex-col animate-slide-up">
        <Card className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold">{headerText}</h2>
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      chatMutation.isPending && "animate-shimmer font-medium",
                    )}
                  >
                    {chatMutation.isPending ? "Pensando na melhor resposta..." : "Online"}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetChat}
                disabled={chatMutation.isPending || uploadMutation.isPending}
                title="Reiniciar conversa"
                className="shrink-0"
              >
                <RotateCcw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reiniciar chat</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3", message.sender === "user" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    message.sender === "bot" ? "bg-primary/10" : "bg-secondary",
                  )}
                >
                  {message.sender === "bot" ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    message.sender === "bot"
                      ? "rounded-tl-none bg-secondary text-foreground"
                      : "rounded-tr-none bg-primary text-primary-foreground",
                  )}
                >
                  {renderMarkdown(message.content)}
                </div>
              </div>
            ))}

            {chatMutation.isPending ? (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-secondary px-4 py-3 text-sm text-muted-foreground">
                  <p className="animate-shimmer font-medium">A Clinix está organizando a resposta...</p>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 ? (
            <div className="px-4 pb-2">
              <p className="mb-2 text-xs text-muted-foreground">Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full bg-secondary px-3 py-1.5 text-sm transition-colors hover:bg-secondary/80"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-border p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                onChange={handleUpload}
                disabled={uploadMutation.isPending || isDoctor}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleFilePickerOpen}
                disabled={chatMutation.isPending || uploadMutation.isPending || isDoctor}
                title={
                  isDoctor
                    ? "Upload de documentos disponível para pacientes"
                    : "Enviar documento para o chatbot"
                }
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Digite sua mensagem..."
                className="input-focus flex-1"
                disabled={chatMutation.isPending || uploadMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={chatMutation.isPending || uploadMutation.isPending || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
