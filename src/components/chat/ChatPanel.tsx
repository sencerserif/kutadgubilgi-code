"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Square,
  Trash2,
  Settings,
  Paperclip,
  Sparkles,
  User,
  Bot,
  Copy,
  Check,
  Loader2,
  DollarSign,
  Terminal as TerminalIcon,
  X,
  Zap,
  Bot as BotIcon,
  FileText,
  GitBranch,
  Shield,
  Database,
  Puzzle,
  FileEdit,
  Plug,
  Command as CommandIcon,
  Pin,
  PinOff,
  Download,
  Upload,
  Palette,
  Users,
  Wrench,
  Globe,
  History,
  Image as ImageIcon,
  Brain,
  Monitor,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { PROVIDERS, getModel } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";
import { ProviderSelector } from "./ProviderSelector";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { createDiff, extractCodeBlocks } from "@/lib/diff";
import { processSlashCommand, getSlashCommandSuggestions } from "@/lib/slashCommands";
import type { ChatMessage, ProviderId, CostEntry, DiffResult } from "@/types";

const SAMPLE_PROMPTS = [
  "React'te bir todo list component yaz",
  "Bu Python kodundaki hatayı bul ve düzelt",
  "TypeScript ile REST API client oluştur",
  "SQL sorgusu optimizasyonu yap",
];

export function ChatPanel({ onViewDiff }: { onViewDiff?: (diff: DiffResult) => void }) {
  const {
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    isStreaming,
    setStreaming,
    settings,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    routingMode,
    openFiles,
    activeFile,
    addCost,
    setSettingsOpen,
    setCostPanelOpen,
    setTerminalOpen,
    setComparePanelOpen,
    setAgentPanelOpen,
    setSnippetsPanelOpen,
    setGitTimelineOpen,
    setReviewPanelOpen,
    setRagPanelOpen,
    setPluginsPanelOpen,
    streamingEnabled,
    setMcpPanelOpen,
    setCommandPaletteOpen,
    setActiveMobilePanel,
    togglePinMessage,
    exportChat,
    importChat,
    setThemePanelOpen,
    setCollabPanelOpen,
    pendingImages,
    addPendingImage,
    removePendingImage,
    clearPendingImages,
    reasoningMode,
    setReasoningMode,
    fileTree,
    addContextFile,
    chatTabs,
    activeChatTabId,
    setActiveChatTab,
    addChatTab,
    removeChatTab,
    setComputerUseOpen,
  } = useStore();

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [routingInfo, setRoutingInfo] = useState<string | null>(null);
  const [slashSuggestions, setSlashSuggestions] = useState<string[]>([]);
  const [useToolMode, setUseToolMode] = useState(false);
  const [fileMentions, setFileMentions] = useState<string[]>([]);
  const [showFileMentions, setShowFileMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Slash command autocomplete
  useEffect(() => {
    if (input.startsWith("/") && !input.includes(" ")) {
      setSlashSuggestions(getSlashCommandSuggestions(input));
    } else {
      setSlashSuggestions([]);
    }
  }, [input]);

  // @file mention detection
  useEffect(() => {
    const lastAt = input.lastIndexOf("@");
    if (lastAt === -1) {
      setShowFileMentions(false);
      return;
    }
    const afterAt = input.slice(lastAt + 1);
    if (afterAt.includes(" ")) {
      setShowFileMentions(false);
      return;
    }
    setMentionQuery(afterAt);
    setShowFileMentions(true);
  }, [input]);

  // Flatten file tree for @mentions
  const flatFiles = useMemo(() => {
    const result: Array<{ path: string; name: string }> = [];
    const walk = (nodes: typeof fileTree) => {
      for (const node of nodes) {
        if (node.type === "file") {
          result.push({ path: node.path, name: node.name });
        }
        if (node.children) walk(node.children);
      }
    };
    walk(fileTree);
    return result;
  }, [fileTree]);

  const filteredMentions = useMemo(() => {
    if (!showFileMentions) return [];
    const q = mentionQuery.toLowerCase();
    return flatFiles
      .filter((f) => !q || f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [showFileMentions, mentionQuery, flatFiles]);

  const insertMention = (filePath: string) => {
    const lastAt = input.lastIndexOf("@");
    if (lastAt === -1) return;
    const newInput = input.slice(0, lastAt) + `@${filePath} ` + input.slice(lastAt + mentionQuery.length + 1);
    setInput(newInput);
    setShowFileMentions(false);
    addContextFile(filePath);
    toast.success(`Context'e eklendi: ${filePath}`);
  };

  // Image upload handler
  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        addPendingImage({
          url: reader.result as string,
          mimeType: file.type,
          filename: file.name,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // PDF export handler
  const exportPdf = async () => {
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          title: "Kutadgubilgi Code Sohbet Raporu",
        }),
      });
      if (!res.ok) throw new Error("PDF oluşturulamadı");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kutadgubilgi-sohbet-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF dışa aktarıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF hatası");
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    // Slash command kontrolü
    if (input.trim().startsWith("/")) {
      const result = processSlashCommand(input);
      if (result.handled) {
        if (result.output) {
          addMessage({
            id: `system-${Date.now()}`,
            role: "assistant",
            content: result.output,
            timestamp: Date.now(),
          });
        }
        if (result.clearInput) {
          setInput("");
          setSlashSuggestions([]);
        }
        return;
      }
    }

    const prompt = input.trim();
    setInput("");
    setSlashSuggestions([]);

    let provider: ProviderId = selectedProvider;
    let model = selectedModel;
    let routeReason: string | null = null;

    if (routingMode === "smart") {
      const fileContext = activeFile
        ? openFiles.find((f) => f.path === activeFile)?.content ?? ""
        : "";
      const decision = routePrompt(
        {
          prompt,
          hasImages: false,
          fileContext,
          codeLength: fileContext.length,
          isReasoning: false,
        },
        settings.apiKeys
      );
      provider = decision.provider;
      model = decision.model;
      routeReason = decision.reason;
      setSelectedProvider(provider);
      setSelectedModel(model);
      setRoutingInfo(routeReason);
    } else {
      setRoutingInfo(null);
    }

    if (provider !== "ollama" && !settings.apiKeys[provider]) {
      toast.error(`${PROVIDERS[provider].name} API anahtarı yok`, {
        description: "Ayarlar'dan ekleyin",
        action: {
          label: "Ayarlar",
          onClick: () => setSettingsOpen(true),
        },
      });
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? pendingImages : undefined,
    };
    addMessage(userMsg);
    const sentImages = pendingImages.length > 0 ? [...pendingImages] : undefined;
    clearPendingImages();

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      provider,
      model,
      timestamp: Date.now(),
      isStreaming: true,
    };
    addMessage(assistantMsg);
    setStreaming(true);

    const contextMessages = [...messages, userMsg].slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images,
    } as { role: "user" | "assistant" | "system"; content: string; images?: Array<{ url: string; mimeType: string }> }));

    if (activeFile) {
      const file = openFiles.find((f) => f.path === activeFile);
      if (file && file.content) {
        contextMessages.push({
          role: "user",
          content: `[Aktif dosya: ${file.path}]\n\`\`\`\n${file.content.slice(0, 8000)}\n\`\`\``,
        });
      }
    }

    abortRef.current = new AbortController();

    try {
      // Tool Use modu - AI tool çağırabilir
      if (useToolMode) {
        const res = await fetch("/api/ai/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            model,
            messages: contextMessages,
            apiKey: settings.apiKeys[provider] ?? "",
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            systemPrompt: settings.systemPrompt,
            permissions: {
              autoApproveReads: true,
              autoApproveWrites: true,
              autoApproveBash: true,
              autoApproveSearch: true,
            },
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        let diff: DiffResult | undefined;
        if (data.toolResults) {
          const editResult = data.toolResults.find((r: { diff?: unknown }) => r.diff);
          if (editResult?.diff) diff = editResult.diff;
        }

        updateMessage(assistantId, {
          content: data.content || "(AI tool kullandı, sonuç yukarıda)",
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          isStreaming: false,
          diff,
        });

        const modelInfo = getModel(provider, model);
        if (modelInfo && data.tokensIn) {
          const cost =
            (data.tokensIn / 1000) * modelInfo.inputCostPer1k +
            (data.tokensOut / 1000) * modelInfo.outputCostPer1k;
          addCost({
            id: `cost-${Date.now()}`,
            provider,
            model,
            tokensIn: data.tokensIn,
            tokensOut: data.tokensOut,
            cost,
            timestamp: Date.now(),
            messagePreview: prompt.slice(0, 100),
          });
        }
        return;
      }

      // Streaming mode
      if (streamingEnabled) {
        const res = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            model,
            messages: contextMessages,
            apiKey: settings.apiKeys[provider] ?? "",
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            systemPrompt: settings.systemPrompt,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream okunamadı");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let tokensIn = 0;
        let tokensOut = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "delta" && parsed.content) {
                fullContent += parsed.content;
                updateMessage(assistantId, { content: fullContent });
              } else if (parsed.type === "usage") {
                if (parsed.tokensIn) tokensIn += parsed.tokensIn;
                if (parsed.tokensOut) tokensOut += parsed.tokensOut;
              } else if (parsed.type === "error") {
                throw new Error(parsed.error);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message.includes("Hata")) {
                throw parseErr;
              }
            }
          }
        }

        // Diff oluştur
        let diff: DiffResult | undefined;
        if (activeFile && fullContent) {
          const blocks = extractCodeBlocks(fullContent);
          const file = openFiles.find((f) => f.path === activeFile);
          if (file && blocks.length > 0) {
            const matchingBlock =
              blocks.find(
                (b) =>
                  b.filename === file.name ||
                  b.filename === file.path ||
                  b.language === file.language
              ) ?? blocks[0];
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
            diff = createDiff(file.path, file.content, matchingBlock.code, ext);
          }
        }

        updateMessage(assistantId, {
          content: fullContent,
          tokensIn,
          tokensOut,
          isStreaming: false,
          diff,
        });

        // Cost
        const modelInfo = getModel(provider, model);
        if (modelInfo) {
          const cost =
            (tokensIn / 1000) * modelInfo.inputCostPer1k +
            (tokensOut / 1000) * modelInfo.outputCostPer1k;
          addCost({
            id: `cost-${Date.now()}`,
            provider,
            model,
            tokensIn,
            tokensOut,
            cost,
            timestamp: Date.now(),
            messagePreview: prompt.slice(0, 100),
          });
        }
      } else {
        // Non-streaming fallback
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            model,
            messages: contextMessages,
            apiKey: settings.apiKeys[provider] ?? "",
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            systemPrompt: settings.systemPrompt,
            reasoning: reasoningMode,
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        let diff: DiffResult | undefined;
        if (activeFile && data.content) {
          const blocks = extractCodeBlocks(data.content);
          const file = openFiles.find((f) => f.path === activeFile);
          if (file && blocks.length > 0) {
            const matchingBlock =
              blocks.find(
                (b) =>
                  b.filename === file.name ||
                  b.filename === file.path ||
                  b.language === file.language
              ) ?? blocks[0];
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
            diff = createDiff(file.path, file.content, matchingBlock.code, ext);
          }
        }

        updateMessage(assistantId, {
          content: data.content,
          reasoning: data.reasoning,
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          isStreaming: false,
          diff,
        });

        const modelInfo = getModel(provider, model);
        if (modelInfo) {
          const cost =
            (data.tokensIn / 1000) * modelInfo.inputCostPer1k +
            (data.tokensOut / 1000) * modelInfo.outputCostPer1k;
          addCost({
            id: `cost-${Date.now()}`,
            provider,
            model,
            tokensIn: data.tokensIn,
            tokensOut: data.tokensOut,
            cost,
            timestamp: Date.now(),
            messagePreview: prompt.slice(0, 100),
          });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        updateMessage(assistantId, {
          content:
            (useStore.getState().messages.find((m) => m.id === assistantId)?.content ?? "") +
            "\n\n*[^Durduruldu]*",
          isStreaming: false,
        });
      } else {
        const errMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
        updateMessage(assistantId, {
          content: `**Hata:** ${errMsg}`,
          isStreaming: false,
        });
        toast.error(errMsg);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [
    input,
    isStreaming,
    routingMode,
    selectedProvider,
    selectedModel,
    settings,
    messages,
    activeFile,
    openFiles,
    addMessage,
    updateMessage,
    setStreaming,
    setSelectedProvider,
    setSelectedModel,
    addCost,
    setSettingsOpen,
    streamingEnabled,
    useToolMode,
  ]);

  const handleStop = () => abortRef.current?.abort();

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-3 py-2 flex items-center gap-1.5 flex-wrap">
        <a
          href="https://kutadgubilgi.com"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          title="kutadgubilgi.com"
        >
          <Image
            src="/logo.png"
            alt="Kutadgubilgi Code"
            width={24}
            height={24}
            className="rounded-md"
            priority
          />
          <span className="text-sm font-semibold">Kutadgubilgi Code</span>
        </a>
        <span className="flex-1" />
        <a
          href="https://kutadgubilgi.com"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 hover:border-primary/50"
          title="kutadgubilgi.com"
        >
          <Globe className="h-3 w-3" />
          <span className="hidden sm:inline">kutadgubilgi.com</span>
        </a>
        <ProviderSelector compact />

        {/* Tool buttons */}
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolButton
            icon={<Zap className="h-3.5 w-3.5" />}
            title="Çoklu Sağlayıcı Karşılaştırma"
            onClick={() => setComparePanelOpen(true)}
            color="text-amber-500"
          />
          <ToolButton
            icon={<BotIcon className="h-3.5 w-3.5" />}
            title="Agent Modu"
            onClick={() => setAgentPanelOpen(true)}
            color="text-primary"
          />
          <ToolButton
            icon={<Monitor className="h-3.5 w-3.5" />}
            title="Computer Use - PC Kontrolü (Claude Code gibi)"
            onClick={() => setComputerUseOpen(true)}
            color="text-red-500"
          />
          <ToolButton
            icon={<FileText className="h-3.5 w-3.5" />}
            title="Snippet'ler"
            onClick={() => setSnippetsPanelOpen(true)}
          />
          <ToolButton
            icon={<Shield className="h-3.5 w-3.5" />}
            title="Code Review"
            onClick={() => setReviewPanelOpen(true)}
            color="text-emerald-500"
          />
          <ToolButton
            icon={<Database className="h-3.5 w-3.5" />}
            title="Doküman Arama (RAG)"
            onClick={() => setRagPanelOpen(true)}
            color="text-purple-500"
          />
          <ToolButton
            icon={<GitBranch className="h-3.5 w-3.5" />}
            title="Git Timeline"
            onClick={() => setGitTimelineOpen(true)}
            color="text-orange-500"
          />
          <ToolButton
            icon={<Puzzle className="h-3.5 w-3.5" />}
            title="Plugin'ler"
            onClick={() => setPluginsPanelOpen(true)}
            color="text-cyan-500"
          />
          <ToolButton
            icon={<Plug className="h-3.5 w-3.5" />}
            title="MCP Server'lar"
            onClick={() => setMcpPanelOpen(true)}
            color="text-primary"
          />
          <ToolButton
            icon={<CommandIcon className="h-3.5 w-3.5" />}
            title="Komut Palette (Cmd+K)"
            onClick={() => setCommandPaletteOpen(true)}
          />
          <ToolButton
            icon={<History className="h-3.5 w-3.5" />}
            title="Geçmiş Arama (Ctrl+R)"
            onClick={() => {
              // Trigger Ctrl+R
              const event = new KeyboardEvent("keydown", {
                key: "r",
                ctrlKey: true,
                metaKey: true,
              });
              window.dispatchEvent(event);
            }}
            color="text-cyan-500"
          />
          <ToolButton
            icon={<TerminalIcon className="h-3.5 w-3.5" />}
            title="Terminal"
            onClick={() => setTerminalOpen(true)}
          />
          <ToolButton
            icon={<DollarSign className="h-3.5 w-3.5" />}
            title="Maliyet Takibi"
            onClick={() => setCostPanelOpen(true)}
            color="text-amber-500"
          />
          <ToolButton
            icon={<Palette className="h-3.5 w-3.5" />}
            title="Temalar"
            onClick={() => setThemePanelOpen(true)}
            color="text-purple-500"
          />
          <ToolButton
            icon={<Users className="h-3.5 w-3.5" />}
            title="İşbirliği (Multi-user)"
            onClick={() => setCollabPanelOpen(true)}
            color="text-emerald-500"
          />
          <ToolButton
            icon={<Settings className="h-3.5 w-3.5" />}
            title="Ayarlar"
            onClick={() => setSettingsOpen(true)}
          />
          {messages.length > 0 && (
            <>
              <ToolButton
                icon={<Download className="h-3.5 w-3.5" />}
                title="Sohbeti Dışa Aktar (JSON)"
                onClick={() => {
                  exportChat();
                  toast.success("Sohbet dışa aktarıldı");
                }}
              />
              <ToolButton
                icon={<Upload className="h-3.5 w-3.5" />}
                title="Sohbet İçe Aktar"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (Array.isArray(data.messages)) {
                        importChat(data.messages);
                        toast.success(`${data.messages.length} mesaj içe aktarıldı`);
                      } else {
                        toast.error("Geçersiz format");
                      }
                    } catch {
                      toast.error("Dosya okunamadı");
                    }
                  };
                  input.click();
                }}
              />
              <ToolButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                title="Sohbeti Temizle"
                onClick={() => {
                  if (confirm("Sohbet temizlensin mi?")) {
                    clearMessages();
                    setRoutingInfo(null);
                  }
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <a
              href="https://kutadgubilgi.com"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-80 transition-opacity mb-3"
              title="kutadgubilgi.com"
            >
              <Image
                src="/logo.png"
                alt="Kutadgubilgi Code"
                width={64}
                height={64}
                className="rounded-2xl"
                priority
              />
            </a>
            <h2 className="text-lg font-semibold mb-1">
              Kutadgubilgi Code&apos;ya Hoş Geldiniz
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mb-4">
              7 AI sağlayıcı + 12 özellik. Akıllı routing, agent modu, diff
              viewer, code review, RAG ve daha fazlası.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md text-left">
              <FeaturePill icon={<Zap className="h-3 w-3 text-amber-500" />} label="Multi-Provider Compare" onClick={() => setComparePanelOpen(true)} />
              <FeaturePill icon={<BotIcon className="h-3 w-3 text-primary" />} label="Agent Modu" onClick={() => setAgentPanelOpen(true)} />
              <FeaturePill icon={<Shield className="h-3 w-3 text-emerald-500" />} label="Code Review" onClick={() => setReviewPanelOpen(true)} />
              <FeaturePill icon={<Database className="h-3 w-3 text-purple-500" />} label="Doküman RAG" onClick={() => setRagPanelOpen(true)} />
              <FeaturePill icon={<GitBranch className="h-3 w-3 text-orange-500" />} label="Git Timeline" onClick={() => setGitTimelineOpen(true)} />
              <FeaturePill icon={<Puzzle className="h-3 w-3 text-cyan-500" />} label="Plugin'ler" onClick={() => setPluginsPanelOpen(true)} />
            </div>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg mt-4">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent text-foreground/80 border border-border transition-colors"
                  onClick={() => setInput(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            {Object.keys(settings.apiKeys).length === 0 && (
              <div className="mt-4 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-md border border-amber-500/20">
                Başlamak için ayarlardan en az bir API anahtarı ekleyin
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-1 text-amber-500 underline"
                  onClick={() => setSettingsOpen(true)}
                >
                  Ayarları Aç
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            {/* Pinned messages first */}
            {messages.some((m) => m.pinned) && (
              <div className="border-l-2 border-primary pl-3 mb-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-1">
                  <Pin className="h-2.5 w-2.5" />
                  Sabitlenmiş
                </div>
                {messages.filter((m) => m.pinned).map((msg) => (
                  <MessageBubble
                    key={`pinned-${msg.id}`}
                    message={msg}
                    onCopy={() => handleCopy(msg.id, msg.content)}
                    copied={copiedId === msg.id}
                    onViewDiff={onViewDiff}
                    onPin={() => togglePinMessage(msg.id)}
                    compact
                  />
                ))}
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCopy={() => handleCopy(msg.id, msg.content)}
                copied={copiedId === msg.id}
                onViewDiff={onViewDiff}
                onPin={() => togglePinMessage(msg.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Routing Info */}
      {routingInfo && (
        <div className="px-4 py-1.5 border-t border-border bg-secondary/30">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>{routingInfo}</span>
            <button
              className="ml-auto hover:text-foreground"
              onClick={() => setRoutingInfo(null)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="max-w-3xl mx-auto">
          {/* Slash command suggestions */}
          {slashSuggestions.length > 0 && (
            <div className="mb-1 border border-border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
              {slashSuggestions.map((s, i) => {
                const cmd = s.split(" - ")[0];
                const desc = s.split(" - ").slice(1).join(" - ");
                return (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent first:rounded-t-md last:rounded-b-md"
                    onClick={() => {
                      setInput(cmd + " ");
                      setSlashSuggestions([]);
                    }}
                  >
                    <span className="text-primary font-mono">{cmd}</span>
                    {desc && (
                      <span className="text-muted-foreground ml-2">{desc}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* @file mention suggestions */}
          {showFileMentions && filteredMentions.length > 0 && (
            <div className="mb-1 border border-border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                📎 Dosyalar ({filteredMentions.length})
              </div>
              {filteredMentions.map((f, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent first:rounded-t-md last:rounded-b-md flex items-center gap-2"
                  onClick={() => insertMention(f.path)}
                >
                  <FileText className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-mono">{f.path}</span>
                </button>
              ))}
            </div>
          )}

          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1 p-1.5 border border-border rounded-md bg-secondary/30">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img.url}
                    alt={img.filename ?? `image-${idx}`}
                    className="h-12 w-12 object-cover rounded border border-border"
                  />
                  <button
                    onClick={() => removePendingImage(idx)}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                  {img.filename && (
                    <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-black/70 text-white px-1 truncate rounded-b">
                      {img.filename}
                    </span>
                  )}
                </div>
              ))}
              <button
                onClick={() => clearPendingImages()}
                className="text-[10px] text-destructive hover:underline self-center ml-1"
              >
                Tümünü temizle
              </button>
            </div>
          )}

          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                useToolMode
                  ? "Tool modu aktif - AI dosya okuyabilir/düzenleyebilir, komut çalıştırabilir... (/help ile komutlar)"
                  : "Mesajınızı yazın... (/help, Enter ile gönder, Shift+Enter yeni satır)"
              }
              className={`min-h-[60px] max-h-48 resize-none pr-32 text-sm ${
                useToolMode ? "border-primary" : ""
              }`}
              disabled={isStreaming}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <VoiceButton
                onTranscript={(text) => setInput((prev) => prev + " " + text)}
                speakText={undefined}
              />
              {isStreaming ? (
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7"
                  onClick={handleStop}
                >
                  <Square className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  <Send className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{input.length} karakter</span>
              {activeFile && (
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  <Paperclip className="h-2.5 w-2.5 mr-1" />
                  {activeFile.split("/").pop()}
                </Badge>
              )}
              <button
                onClick={() => setUseToolMode(!useToolMode)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${
                  useToolMode
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border"
                }`}
                title="AI Tool Use modu - AI dosya okuyabilir/düzenleyebilir, komut çalıştırabilir"
              >
                <Wrench className="h-2.5 w-2.5" />
                {useToolMode ? "Tool modu AÇIK" : "Tool modu"}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[9px] hover:bg-accent"
                title="Resim yükle (Vision - GPT-4V, Claude, Gemini)"
              >
                <ImageIcon className="h-2.5 w-2.5" />
                {pendingImages.length > 0 ? `${pendingImages.length} resim` : "Resim"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleImageUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => setReasoningMode(!reasoningMode)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${
                  reasoningMode
                    ? "border-purple-500 text-purple-500 bg-purple-500/10"
                    : "border-border"
                }`}
                title="Reasoning mode - o1/DeepSeek R1 chain-of-thought gösterimi"
              >
                <Brain className="h-2.5 w-2.5" />
                {reasoningMode ? "Reasoning AÇIK" : "Reasoning"}
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
              <span>
                {routingMode === "smart" ? "Akıllı routing" : "Manuel"}
                {useToolMode && " · Tool"}
                {reasoningMode && " · Reasoning"}
                {pendingImages.length > 0 && ` · ${pendingImages.length} resim`}
              </span>
              {messages.length > 0 && (
                <button
                  onClick={exportPdf}
                  className="hover:text-primary flex items-center gap-0.5"
                  title="PDF olarak dışa aktar"
                >
                  <FileText className="h-2.5 w-2.5" />
                  PDF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  title,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 ${color ?? ""}`}
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  );
}

function FeaturePill({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-secondary/30 hover:bg-secondary text-xs transition-colors"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MessageBubble({
  message,
  onCopy,
  copied,
  onViewDiff,
  onPin,
  compact = false,
}: {
  message: ChatMessage;
  onCopy: () => void;
  copied: boolean;
  onViewDiff?: (diff: DiffResult) => void;
  onPin?: () => void;
  compact?: boolean;
}) {
  const isUser = message.role === "user";
  const provider = message.provider ? PROVIDERS[message.provider] : null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary border border-border"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : provider ? (
          <span
            className="text-[10px] font-bold"
            style={{ color: provider.color }}
          >
            {provider.name[0]}
          </span>
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? "items-end" : ""} flex flex-col`}>
        <div
          className={`rounded-lg px-3 py-2 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary border border-border"
          }`}
        >
          {message.isStreaming && !message.content ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Düşünüyor...
            </div>
          ) : isUser ? (
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="markdown-body text-sm">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !className;
                    return !isInline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          background: "transparent",
                          fontSize: "0.8rem",
                        }}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Diff Apply Button */}
        {!isUser && message.diff && message.diff.hunks.length > 0 && (
          <button
            className="mt-1 text-[10px] text-primary hover:underline flex items-center gap-1"
            onClick={() => onViewDiff?.(message.diff!)}
          >
            <FileEdit className="h-2.5 w-2.5" />
            Diff'i gör ({message.diff.hunks.length} hunk · {message.diff.filePath})
          </button>
        )}

        {/* Footer */}
        {!isUser && !message.isStreaming && message.content && (
          <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-muted-foreground">
            {provider && (
              <span className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: provider.color }}
                />
                {provider.name} {message.model && `· ${message.model}`}
              </span>
            )}
            {message.tokensIn && message.tokensOut ? (
              <span>· {message.tokensIn}→{message.tokensOut} token</span>
            ) : null}
            <button onClick={onCopy} className="ml-auto hover:text-foreground" title="Kopyala">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            {onPin && (
              <button
                onClick={onPin}
                className={`hover:text-foreground ${message.pinned ? "text-primary" : ""}`}
                title={message.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
              >
                {message.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
