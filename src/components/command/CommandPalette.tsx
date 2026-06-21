"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/store/useStore";
import { Command } from "cmdk";
import {
  Zap,
  Bot,
  Sparkles,
  Shield,
  Database,
  GitBranch,
  Puzzle,
  Terminal as TerminalIcon,
  DollarSign,
  Settings,
  Plus,
  Trash2,
  Plug,
  Search,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Activity,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setComparePanelOpen,
    setAgentPanelOpen,
    setSnippetsPanelOpen,
    setReviewPanelOpen,
    setRagPanelOpen,
    setGitTimelineOpen,
    setPluginsPanelOpen,
    setTerminalOpen,
    setCostPanelOpen,
    setSettingsOpen,
    setMcpPanelOpen,
    clearMessages,
    clearCost,
    streamingEnabled,
    setStreamingEnabled,
    routingMode,
    setRoutingMode,
  } = useStore();

  const [query, setQuery] = useState("");

  const commands: CommandItem[] = [
    // AI Tools
    {
      id: "compare",
      label: "Multi-Provider Karşılaştırma",
      description: "Aynı promptu birden fazla AI'a paralel gönder",
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      group: "AI Tools",
      action: () => setComparePanelOpen(true),
      keywords: ["compare", "karşılaştır", "parallel"],
    },
    {
      id: "agent",
      label: "Agent Modu",
      description: "Otonom AI agent'ı başlat",
      icon: <Bot className="h-4 w-4 text-primary" />,
      group: "AI Tools",
      action: () => setAgentPanelOpen(true),
      keywords: ["agent", "otonom", "task"],
    },
    {
      id: "snippets",
      label: "Snippet'ler",
      description: "Hazır prompt template'leri",
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      group: "AI Tools",
      action: () => setSnippetsPanelOpen(true),
      keywords: ["snippet", "template", "prompt"],
    },
    {
      id: "review",
      label: "Code Review",
      description: "AI ile kod incelemesi yap",
      icon: <Shield className="h-4 w-4 text-emerald-500" />,
      group: "AI Tools",
      action: () => setReviewPanelOpen(true),
      keywords: ["review", "incele", "güvenlik"],
    },

    // Data & Context
    {
      id: "rag",
      label: "Doküman Arama (RAG)",
      description: "Doküman yükle ve semantik arama yap",
      icon: <Database className="h-4 w-4 text-purple-500" />,
      group: "Data",
      action: () => setRagPanelOpen(true),
      keywords: ["rag", "document", "doküman", "vector"],
    },
    {
      id: "git",
      label: "Git Timeline",
      description: "Commit geçmişini gör, AI ile özetle",
      icon: <GitBranch className="h-4 w-4 text-orange-500" />,
      group: "Data",
      action: () => setGitTimelineOpen(true),
      keywords: ["git", "commit", "timeline"],
    },

    // Integrations
    {
      id: "plugins",
      label: "Plugin Yöneticisi",
      description: "Web arama, Slack, Jira, DB, Figma, OpenAPI",
      icon: <Puzzle className="h-4 w-4 text-cyan-500" />,
      group: "Integrations",
      action: () => setPluginsPanelOpen(true),
      keywords: ["plugin", "slack", "jira", "figma"],
    },
    {
      id: "mcp",
      label: "MCP Server'lar",
      description: "Model Context Protocol server'larını yönet",
      icon: <Plug className="h-4 w-4 text-primary" />,
      group: "Integrations",
      action: () => setMcpPanelOpen(true),
      keywords: ["mcp", "server", "tool"],
    },

    // Utilities
    {
      id: "terminal",
      label: "Terminal",
      description: "Komut çalıştır",
      icon: <TerminalIcon className="h-4 w-4" />,
      group: "Utilities",
      action: () => setTerminalOpen(true),
      keywords: ["terminal", "bash", "shell"],
    },
    {
      id: "cost",
      label: "Maliyet Takibi",
      description: "Token ve maliyet geçmişi",
      icon: <DollarSign className="h-4 w-4 text-amber-500" />,
      group: "Utilities",
      action: () => setCostPanelOpen(true),
      keywords: ["cost", "maliyet", "token", "ücret"],
    },
    {
      id: "settings",
      label: "Ayarlar",
      description: "API anahtarları, model, sistem promptu",
      icon: <Settings className="h-4 w-4" />,
      group: "Utilities",
      action: () => setSettingsOpen(true),
      keywords: ["settings", "ayarlar", "api", "key"],
    },

    // Actions
    {
      id: "clear-chat",
      label: "Sohbeti Temizle",
      icon: <Trash2 className="h-4 w-4 text-destructive" />,
      group: "Actions",
      action: () => {
        if (confirm("Sohbet temizlensin mi?")) {
          clearMessages();
          setCommandPaletteOpen(false);
        }
      },
    },
    {
      id: "clear-cost",
      label: "Maliyet Kayıtlarını Sıfırla",
      icon: <Trash2 className="h-4 w-4 text-destructive" />,
      group: "Actions",
      action: () => {
        if (confirm("Tüm maliyet kayıtları silinsin mi?")) {
          clearCost();
          setCommandPaletteOpen(false);
        }
      },
    },

    // Toggles
    {
      id: "toggle-streaming",
      label: streamingEnabled ? "Streaming'i Kapat" : "Streaming'i Aç",
      description: "Token token akış",
      icon: <Activity className="h-4 w-4" />,
      group: "Toggles",
      action: () => {
        setStreamingEnabled(!streamingEnabled);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "toggle-routing",
      label: routingMode === "smart" ? "Manuel Mode Geç" : "Akıllı Routing Aç",
      description: "Otomatik model seçimi",
      icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      group: "Toggles",
      action: () => {
        setRoutingMode(routingMode === "smart" ? "manual" : "smart");
        setCommandPaletteOpen(false);
      },
    },
  ];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(q)) ||
      cmd.group.toLowerCase().includes(q)
    );
  });

  const grouped: Record<string, CommandItem[]> = {};
  filtered.forEach((cmd) => {
    if (!grouped[cmd.group]) grouped[cmd.group] = [];
    grouped[cmd.group].push(cmd);
  });

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Komut Palette</DialogTitle>
        </DialogHeader>
        <Command className="bg-background" loop>
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 mr-2 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Komut ara... (örn: agent, review, git)"
              value={query}
              onValueChange={setQuery}
              className="h-12 bg-transparent text-sm outline-none flex-1"
            />
            <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Komut bulunamadı.
            </Command.Empty>
            {Object.entries(grouped).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={group}
                className="text-muted-foreground text-[10px] uppercase tracking-wider px-2"
              >
                {items.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    onSelect={() => {
                      cmd.action();
                      setCommandPaletteOpen(false);
                    }}
                    className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer aria-selected:bg-accent text-sm"
                  >
                    <div className="shrink-0">{cmd.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
