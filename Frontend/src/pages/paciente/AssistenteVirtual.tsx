import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, Send, User } from "lucide-react";
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

const chatStoragePrefix = "clinix.chatbot.conversation";

function createInitialMessage(isDoctor: boolean): Message {
  return {
    id: "initial-message",
    content: isDoctor
      ? "Ola, posso ajudar com sua agenda, seus pacientes e rotinas clinicas."
      : "Ola, posso ajudar com suas consultas, seu historico clinico e seus documentos.",
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
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s+|```|[-*]\s+|\d+\.\s+)/.test(lines[index])) {
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

    const persistedState = parsePersistedState(
      window.localStorage.getItem(chatStorageKey),
    );

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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (session?.userType !== "User" || !profile?.userId) {
        throw new Error("Upload de documentos disponivel apenas para pacientes.");
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
            `Recebi o documento "${file.name}". A ingestao foi iniciada com id ` +
            `${response.ingestion_id}. Voce pode continuar conversando enquanto processo o arquivo.`,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel enviar o documento",
        description:
          error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const headerText = useMemo(
    () =>
      isDoctor
        ? "Assistente Clinix para medicos"
        : "Assistente Clinix para pacientes",
    [isDoctor],
  );

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
                  {renderMarkdown(message.content)}
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
                    ? "Upload de documentos disponivel para pacientes"
                    : "Enviar documento para o chatbot"
                }
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 input-focus"
                disabled={chatMutation.isPending || uploadMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={chatMutation.isPending || uploadMutation.isPending || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
