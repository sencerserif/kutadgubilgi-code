"use client";

import { create } from "zustand";
import type {
  ChatMessage,
  OpenFile,
  FileNode,
  CostEntry,
  TerminalCommand,
  ApiKeys,
  ProviderId,
  AppSettings,
  Snippet,
  Workspace,
  AgentTask,
  Plugin,
  McpServer,
  CompareResult,
  CodeReview,
  RagDocument,
  VoiceSettings,
} from "@/types";
import {
  getApiKeys,
  saveApiKeys,
  getSettings,
  saveSettings,
  getCostLog,
  addCostEntry,
  clearCostLog,
} from "@/lib/storage";
import { BUILTIN_SNIPPETS } from "@/lib/snippets";
import { BUILTIN_PLUGINS } from "@/lib/plugins";

interface AppState {
  // Settings
  settings: AppSettings;
  setApiKey: (provider: ProviderId, key: string) => void;
  removeApiKey: (provider: ProviderId) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  loadSettings: () => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  isStreaming: boolean;
  setStreaming: (v: boolean) => void;

  // Routing
  routingMode: "smart" | "manual";
  setRoutingMode: (mode: "smart" | "manual") => void;
  selectedProvider: ProviderId;
  selectedModel: string;
  setSelectedProvider: (p: ProviderId) => void;
  setSelectedModel: (m: string) => void;

  // Files
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  openFiles: OpenFile[];
  activeFile: string | null;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => void;

  // Terminal
  terminalCommands: TerminalCommand[];
  addTerminalCommand: (cmd: TerminalCommand) => void;
  clearTerminal: () => void;
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;

  // Cost tracking
  costLog: CostEntry[];
  addCost: (entry: CostEntry) => void;
  clearCost: () => void;
  loadCostLog: () => void;

  // UI - main panels
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  costPanelOpen: boolean;
  setCostPanelOpen: (v: boolean) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (v: boolean) => void;
  editorVisible: boolean;
  setEditorVisible: (v: boolean) => void;

  // =========== NEW STATE ===========

  // Multi-workspace
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string, path: string) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;

  // Snippets
  snippets: Snippet[];
  addSnippet: (snippet: Omit<Snippet, "id" | "createdAt" | "useCount">) => void;
  removeSnippet: (id: string) => void;
  incrementSnippetUse: (id: string) => void;
  snippetsPanelOpen: boolean;
  setSnippetsPanelOpen: (v: boolean) => void;

  // Compare (multi-provider)
  comparePanelOpen: boolean;
  setComparePanelOpen: (v: boolean) => void;
  compareResults: CompareResult[];
  setCompareResults: (results: CompareResult[]) => void;
  compareLoading: boolean;
  setCompareLoading: (v: boolean) => void;
  compareProviders: Array<{ provider: ProviderId; model: string }>;
  setCompareProviders: (p: Array<{ provider: ProviderId; model: string }>) => void;

  // Agent mode
  agentPanelOpen: boolean;
  setAgentPanelOpen: (v: boolean) => void;
  agentTasks: AgentTask[];
  addAgentTask: (task: AgentTask) => void;
  updateAgentTask: (id: string, updates: Partial<AgentTask>) => void;
  updateAgentStep: (taskId: string, stepId: string, updates: Partial<AgentTask["steps"][number]>) => void;
  clearAgentTasks: () => void;

  // Git timeline
  gitTimelineOpen: boolean;
  setGitTimelineOpen: (v: boolean) => void;

  // Code review
  reviewPanelOpen: boolean;
  setReviewPanelOpen: (v: boolean) => void;
  reviews: CodeReview[];
  addReview: (review: CodeReview) => void;

  // RAG
  ragPanelOpen: boolean;
  setRagPanelOpen: (v: boolean) => void;
  ragDocuments: RagDocument[];
  addRagDocument: (doc: RagDocument) => void;
  removeRagDocument: (id: string) => void;
  setRagDocuments: (docs: RagDocument[]) => void;

  // Plugins
  pluginsPanelOpen: boolean;
  setPluginsPanelOpen: (v: boolean) => void;
  plugins: Plugin[];
  togglePlugin: (id: string) => void;
  updatePluginConfig: (id: string, config: Record<string, unknown>) => void;

  // MCP
  mcpServers: McpServer[];
  addMcpServer: (server: McpServer) => void;
  removeMcpServer: (id: string) => void;

  // Voice
  voiceSettings: VoiceSettings;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  isListening: boolean;
  setListening: (v: boolean) => void;
  isSpeaking: boolean;
  setSpeaking: (v: boolean) => void;

  // =========== v3 NEW STATE ===========

  // Streaming
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;

  // Mobile sidebar (responsive)
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  mobileEditorOpen: boolean;
  setMobileEditorOpen: (v: boolean) => void;
  activeMobilePanel: "files" | "chat" | "editor";
  setActiveMobilePanel: (p: "files" | "chat" | "editor") => void;

  // MCP panel
  mcpPanelOpen: boolean;
  setMcpPanelOpen: (v: boolean) => void;
  mcpServers: Array<{
    id: string;
    name: string;
    url: string;
    transport: "stdio" | "sse" | "http";
    enabled: boolean;
    tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  }>;
  setMcpServers: (servers: Array<{
    id: string;
    name: string;
    url: string;
    transport: "stdio" | "sse" | "http";
    enabled: boolean;
    tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  }>) => void;

  // RAG embeddings mode
  ragUseEmbeddings: boolean;
  setRagUseEmbeddings: (v: boolean) => void;

  // Onboarding wizard
  onboardingOpen: boolean;
  setOnboardingOpen: (v: boolean) => void;
  onboardingStep: number;
  setOnboardingStep: (v: number) => void;
  onboardingCompleted: boolean;
  setOnboardingCompleted: (v: boolean) => void;

  // v4 - Bonus features
  // Recent files
  recentFiles: string[];
  addRecentFile: (path: string) => void;

  // Pin message
  togglePinMessage: (id: string) => void;

  // Chat export/import
  exportChat: () => void;
  importChat: (messages: ChatMessage[]) => void;

  // =========== v5 NEW ===========
  // Theme
  activeThemeId: string;
  setActiveThemeId: (id: string) => void;
  themePanelOpen: boolean;
  setThemePanelOpen: (v: boolean) => void;
  customColors: Record<string, string> | null;
  setCustomColors: (colors: Record<string, string> | null) => void;

  // Collab
  collabPanelOpen: boolean;
  setCollabPanelOpen: (v: boolean) => void;
  collabSessionId: string | null;
  setCollabSessionId: (id: string | null) => void;
  collabUserId: string;
  collabUserName: string;
  setCollabUserName: (name: string) => void;

  // System prompt presets
  systemPromptPresets: Array<{ id: string; name: string; prompt: string; isBuiltIn?: boolean }>;
  addSystemPromptPreset: (preset: { name: string; prompt: string }) => void;
  removeSystemPromptPreset: (id: string) => void;

  // =========== v6 NEW (OpenCode-parity) ===========
  // Checkpoints
  checkpoints: Array<{
    id: string;
    name: string;
    timestamp: number;
    messages: ChatMessage[];
    openFiles: OpenFile[];
    activeFile: string | null;
  }>;
  saveCheckpoint: (name: string) => void;
  restoreCheckpoint: (id: string) => void;
  deleteCheckpoint: (id: string) => void;

  // Subagents
  subagents: Array<{
    id: string;
    name: string;
    goal: string;
    status: "running" | "completed" | "failed";
    parentId: string;
    messages: ChatMessage[];
    createdAt: number;
  }>;
  addSubagent: (sub: { name: string; goal: string; parentId: string }) => string;
  updateSubagent: (id: string, updates: Partial<{ status: string; messages: ChatMessage[] }>) => void;
  removeSubagent: (id: string) => void;

  // Custom commands
  customCommands: Array<{
    id: string;
    name: string;
    command: string;
    description?: string;
    isBuiltIn?: boolean;
  }>;
  addCustomCommand: (cmd: { name: string; command: string; description?: string }) => void;
  removeCustomCommand: (id: string) => void;

  // Permissions
  permissions: {
    autoApproveReads: boolean;
    autoApproveWrites: boolean;
    autoApproveBash: boolean;
    autoApproveSearch: boolean;
  };
  updatePermissions: (perms: Partial<{
    autoApproveReads: boolean;
    autoApproveWrites: boolean;
    autoApproveBash: boolean;
    autoApproveSearch: boolean;
  }>) => void;

  // Context files (explicitly attached)
  contextFiles: string[];
  addContextFile: (path: string) => void;
  removeContextFile: (path: string) => void;
  clearContextFiles: () => void;

  // =========== v9 NEW ===========
  // Pending images (vision)
  pendingImages: Array<{ url: string; mimeType: string; filename?: string }>;
  addPendingImage: (img: { url: string; mimeType: string; filename?: string }) => void;
  removePendingImage: (idx: number) => void;
  clearPendingImages: () => void;

  // Reasoning mode (o1/R1)
  reasoningMode: boolean;
  setReasoningMode: (v: boolean) => void;

  // Budget limit
  budgetLimit: number; // USD, 0 = no limit
  setBudgetLimit: (v: number) => void;
  budgetPeriod: "daily" | "monthly" | "session";
  setBudgetPeriod: (p: "daily" | "monthly" | "session") => void;

  // Multi-chat tabs
  chatTabs: Array<{ id: string; name: string; messages: ChatMessage[] }>;
  activeChatTabId: string;
  setActiveChatTab: (id: string) => void;
  addChatTab: (name?: string) => void;
  removeChatTab: (id: string) => void;
  renameChatTab: (id: string, name: string) => void;

  // Status bar
  statusBarVisible: boolean;
  setStatusBarVisible: (v: boolean) => void;

  // =========== v10 Computer Use ===========
  computerUseOpen: boolean;
  setComputerUseOpen: (v: boolean) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: {},
  defaultProvider: "anthropic",
  defaultModel: "claude-3-5-sonnet-20241022",
  routingMode: "smart",
  workspacePath: "/home/z/my-project/workspace",
  theme: "dark",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt:
    "Sen uzman bir yazılım geliştirici asistanısın. Claude Code gibi davran: kod yaz, dosyaları oku ve düzenle, hataları ayıkla. Türkçe yanıt ver.",
  voiceEnabled: true,
  autoSpeak: false,
  voiceRate: 1,
  voicePitch: 1,
};

const DEFAULT_VOICE: VoiceSettings = {
  voiceURI: "",
  rate: 1,
  pitch: 1,
  volume: 1,
  autoSpeak: false,
  sttLanguage: "tr-TR",
};

const DEFAULT_WORKSPACE: Workspace = {
  id: "default",
  name: "Varsayılan",
  path: "/home/z/my-project/workspace",
  color: "#f59e0b",
  createdAt: Date.now(),
  lastActive: Date.now(),
  chatHistory: [],
  openFiles: [],
};

export const useStore = create<AppState>((set, get) => ({
  // Settings
  settings: DEFAULT_SETTINGS,
  setApiKey: (provider, key) => {
    const current = getApiKeys();
    const updated = { ...current, [provider]: key };
    saveApiKeys(updated);
    set((state) => ({
      settings: { ...state.settings, apiKeys: updated },
    }));
  },
  removeApiKey: (provider) => {
    const current = getApiKeys();
    delete current[provider];
    saveApiKeys(current);
    set((state) => ({
      settings: { ...state.settings, apiKeys: { ...current } },
    }));
  },
  updateSettings: (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    saveSettings(partial);
    set({ settings: updated });
  },
  loadSettings: () => {
    const settings = { ...DEFAULT_SETTINGS, ...getSettings() };
    settings.apiKeys = getApiKeys();
    set({
      settings,
      routingMode: settings.routingMode,
      selectedProvider: settings.defaultProvider,
      selectedModel: settings.defaultModel,
    });
  },

  // Chat
  messages: [],
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),
  isStreaming: false,
  setStreaming: (v) => set({ isStreaming: v }),

  // Routing
  routingMode: "smart",
  setRoutingMode: (mode) => {
    set({ routingMode: mode });
    get().updateSettings({ routingMode: mode });
  },
  selectedProvider: "anthropic",
  selectedModel: "claude-3-5-sonnet-20241022",
  setSelectedProvider: (p) => set({ selectedProvider: p }),
  setSelectedModel: (m) => set({ selectedModel: m }),

  // Files
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),
  openFiles: [],
  activeFile: null,
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.path === file.path);
      if (exists) {
        return { activeFile: file.path };
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFile: file.path,
      };
    }),
  closeFile: (path) =>
    set((state) => {
      const idx = state.openFiles.findIndex((f) => f.path === path);
      const newFiles = state.openFiles.filter((f) => f.path !== path);
      let newActive = state.activeFile;
      if (state.activeFile === path) {
        newActive = newFiles[Math.min(idx, newFiles.length - 1)]?.path ?? null;
      }
      return { openFiles: newFiles, activeFile: newActive };
    }),
  setActiveFile: (path) => set({ activeFile: path }),
  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path
          ? { ...f, content, isDirty: content !== f.originalContent }
          : f
      ),
    })),
  saveFile: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path
          ? { ...f, isDirty: false, originalContent: f.content }
          : f
      ),
    })),

  // Terminal
  terminalCommands: [],
  addTerminalCommand: (cmd) =>
    set((state) => ({
      terminalCommands: [...state.terminalCommands.slice(-99), cmd],
    })),
  clearTerminal: () => set({ terminalCommands: [] }),
  terminalOpen: false,
  setTerminalOpen: (v) => set({ terminalOpen: v }),

  // Cost tracking
  costLog: [],
  addCost: (entry) => {
    addCostEntry(entry);
    set((state) => ({ costLog: [...state.costLog, entry] }));
  },
  clearCost: () => {
    clearCostLog();
    set({ costLog: [] });
  },
  loadCostLog: () => {
    set({ costLog: getCostLog() });
  },

  // UI - main
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  costPanelOpen: false,
  setCostPanelOpen: (v) => set({ costPanelOpen: v }),
  sidebarVisible: true,
  setSidebarVisible: (v) => set({ sidebarVisible: v }),
  editorVisible: true,
  setEditorVisible: (v) => set({ editorVisible: v }),

  // =========== NEW ===========

  // Multi-workspace
  workspaces: [DEFAULT_WORKSPACE],
  activeWorkspaceId: "default",
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  addWorkspace: (name, path) =>
    set((state) => ({
      workspaces: [
        ...state.workspaces,
        {
          id: `ws-${Date.now()}`,
          name,
          path,
          color: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6"][
            state.workspaces.length % 5
          ],
          createdAt: Date.now(),
          lastActive: Date.now(),
          chatHistory: [],
          openFiles: [],
        },
      ],
    })),
  removeWorkspace: (id) =>
    set((state) => {
      if (state.workspaces.length === 1) return state;
      const filtered = state.workspaces.filter((w) => w.id !== id);
      return {
        workspaces: filtered,
        activeWorkspaceId:
          state.activeWorkspaceId === id
            ? filtered[0].id
            : state.activeWorkspaceId,
      };
    }),
  renameWorkspace: (id, name) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, name } : w
      ),
    })),

  // Snippets
  snippets: BUILTIN_SNIPPETS,
  addSnippet: (snippet) =>
    set((state) => ({
      snippets: [
        ...state.snippets,
        {
          ...snippet,
          id: `snippet-${Date.now()}`,
          createdAt: Date.now(),
          useCount: 0,
        },
      ],
    })),
  removeSnippet: (id) =>
    set((state) => ({
      snippets: state.snippets.filter(
        (s) => s.id !== id || s.isBuiltIn
      ),
    })),
  incrementSnippetUse: (id) =>
    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id ? { ...s, useCount: s.useCount + 1 } : s
      ),
    })),
  snippetsPanelOpen: false,
  setSnippetsPanelOpen: (v) => set({ snippetsPanelOpen: v }),

  // Compare
  comparePanelOpen: false,
  setComparePanelOpen: (v) => set({ comparePanelOpen: v }),
  compareResults: [],
  setCompareResults: (results) => set({ compareResults: results }),
  compareLoading: false,
  setCompareLoading: (v) => set({ compareLoading: v }),
  compareProviders: [
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
    { provider: "google", model: "gemini-2.0-flash" },
  ],
  setCompareProviders: (p) => set({ compareProviders: p }),

  // Agent
  agentPanelOpen: false,
  setAgentPanelOpen: (v) => set({ agentPanelOpen: v }),
  agentTasks: [],
  addAgentTask: (task) =>
    set((state) => ({ agentTasks: [...state.agentTasks, task] })),
  updateAgentTask: (id, updates) =>
    set((state) => ({
      agentTasks: state.agentTasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      ),
    })),
  updateAgentStep: (taskId, stepId, updates) =>
    set((state) => ({
      agentTasks: state.agentTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              steps: t.steps.map((s) =>
                s.id === stepId ? { ...s, ...updates } : s
              ),
            }
          : t
      ),
    })),
  clearAgentTasks: () => set({ agentTasks: [] }),

  // Git
  gitTimelineOpen: false,
  setGitTimelineOpen: (v) => set({ gitTimelineOpen: v }),

  // Review
  reviewPanelOpen: false,
  setReviewPanelOpen: (v) => set({ reviewPanelOpen: v }),
  reviews: [],
  addReview: (review) =>
    set((state) => ({ reviews: [...state.reviews, review] })),

  // RAG
  ragPanelOpen: false,
  setRagPanelOpen: (v) => set({ ragPanelOpen: v }),
  ragDocuments: [],
  addRagDocument: (doc) =>
    set((state) => ({ ragDocuments: [...state.ragDocuments, doc] })),
  removeRagDocument: (id) =>
    set((state) => ({
      ragDocuments: state.ragDocuments.filter((d) => d.id !== id),
    })),
  setRagDocuments: (docs) => set({ ragDocuments: docs }),

  // Plugins
  pluginsPanelOpen: false,
  setPluginsPanelOpen: (v) => set({ pluginsPanelOpen: v }),
  plugins: BUILTIN_PLUGINS,
  togglePlugin: (id) =>
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    })),
  updatePluginConfig: (id, config) =>
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === id ? { ...p, config: { ...p.config, ...config } } : p
      ),
    })),

  // MCP
  mcpServers: [],
  addMcpServer: (server) =>
    set((state) => ({ mcpServers: [...state.mcpServers, server] })),
  removeMcpServer: (id) =>
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.id !== id),
    })),

  // Voice
  voiceSettings: DEFAULT_VOICE,
  updateVoiceSettings: (partial) =>
    set((state) => ({
      voiceSettings: { ...state.voiceSettings, ...partial },
    })),
  isListening: false,
  setListening: (v) => set({ isListening: v }),
  isSpeaking: false,
  setSpeaking: (v) => set({ isSpeaking: v }),

  // =========== v3 NEW ===========

  // Streaming
  streamingEnabled: true,
  setStreamingEnabled: (v) => set({ streamingEnabled: v }),

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  // Mobile responsive
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
  mobileEditorOpen: false,
  setMobileEditorOpen: (v) => set({ mobileEditorOpen: v }),
  activeMobilePanel: "chat",
  setActiveMobilePanel: (p) => set({ activeMobilePanel: p }),

  // MCP panel
  mcpPanelOpen: false,
  setMcpPanelOpen: (v) => set({ mcpPanelOpen: v }),
  mcpServers: [],
  setMcpServers: (servers) => set({ mcpServers: servers }),

  // RAG embeddings
  ragUseEmbeddings: true,
  setRagUseEmbeddings: (v) => set({ ragUseEmbeddings: v }),

  // Onboarding wizard
  onboardingOpen: false,
  setOnboardingOpen: (v) => set({ onboardingOpen: v }),
  onboardingStep: 0,
  setOnboardingStep: (v) => set({ onboardingStep: v }),
  onboardingCompleted: false,
  setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),

  // v4 - Bonus features
  recentFiles: [],
  addRecentFile: (path) =>
    set((state) => ({
      recentFiles: [
        path,
        ...state.recentFiles.filter((p) => p !== path),
      ].slice(0, 10),
    })),

  togglePinMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, pinned: !m.pinned } : m
      ),
    })),

  exportChat: () => {
    const { messages } = get();
    const data = JSON.stringify(
      {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages,
      },
      null,
      2
    );
    if (typeof window !== "undefined") {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kutadgu-bilig-chat-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  importChat: (importedMessages) =>
    set({ messages: importedMessages }),

  // =========== v5 NEW ===========
  // Theme
  activeThemeId: "dark",
  setActiveThemeId: (id) => set({ activeThemeId: id }),
  themePanelOpen: false,
  setThemePanelOpen: (v) => set({ themePanelOpen: v }),
  customColors: null,
  setCustomColors: (colors) => set({ customColors: colors }),

  // Collab - generate stable user id (lazy init)
  collabPanelOpen: false,
  setCollabPanelOpen: (v) => set({ collabPanelOpen: v }),
  collabSessionId: null,
  setCollabSessionId: (id) => set({ collabSessionId: id }),
  collabUserId: "user-anonymous", // will be initialized client-side
  collabUserName: "Misafir",
  setCollabUserName: (name) => set({ collabUserName: name }),

  // System prompt presets
  systemPromptPresets: [
    {
      id: "default-developer",
      name: "Yazılım Geliştirici",
      isBuiltIn: true,
      prompt:
        "Sen uzman bir yazılım geliştirici asistanısın. Kutadgubilgi Code gibi davran: kod yaz, dosyaları oku ve düzenle, hataları ayıkla. Türkçe yanıt ver. Kod bloklarını markdown formatında ver.",
    },
    {
      id: "code-reviewer",
      name: "Code Reviewer",
      isBuiltIn: true,
      prompt:
        "Sen kıdemli bir code reviewer'sın. Kodu güvenlik, performans, okunabilirlik, best practice açısından incele. Sorunları önem sırasına göre listele, somut düzeltme önerileri ver.",
    },
    {
      id: "teacher",
      name: "Kod Öğretmeni",
      isBuiltIn: true,
      prompt:
        "Sen sabırlı bir kod öğretmenisin. Konuları adım adım açıkla, örneklerle pekiştir. Öğrencinin sorularını yanıtsız bırakma. Basit dilden başla, giderek derinleş.",
    },
    {
      id: "pair-programmer",
      name: "Pair Programmer",
      isBuiltIn: true,
      prompt:
        "Sen bir pair programmersin. Birlikte düşünelim: önce problemi anlamaya çalış, sonra alternatif çözümler öner, avantaj/dezavantajlarını tart, en iyisini birlikte seçelim.",
    },
    {
      id: "turkish-expert",
      name: "Türkçe Uzman",
      isBuiltIn: true,
      prompt:
        "Sen Türkçe konuşan bir AI asistanısın. Tüm yanıtlarını Türkçe ver. Teknik terimleri Türkçe karşılığıyla birlikte kullan. Kod açıklamalarını Türkçe yap.",
    },
  ],
  addSystemPromptPreset: (preset) =>
    set((state) => ({
      systemPromptPresets: [
        ...state.systemPromptPresets,
        {
          ...preset,
          id: `preset-${Date.now()}`,
          isBuiltIn: false,
        },
      ],
    })),
  removeSystemPromptPreset: (id) =>
    set((state) => ({
      systemPromptPresets: state.systemPromptPresets.filter(
        (p) => p.id !== id || p.isBuiltIn
      ),
    })),

  // =========== v6 NEW ===========
  // Checkpoints
  checkpoints: [],
  saveCheckpoint: (name) => {
    const state = get();
    const checkpoint = {
      id: `cp-${Date.now()}`,
      name: name || `Checkpoint ${new Date().toLocaleString("tr-TR")}`,
      timestamp: Date.now(),
      messages: [...state.messages],
      openFiles: state.openFiles.map((f) => ({ ...f })),
      activeFile: state.activeFile,
    };
    set((s) => ({ checkpoints: [...s.checkpoints, checkpoint] }));
  },
  restoreCheckpoint: (id) => {
    const cp = get().checkpoints.find((c) => c.id === id);
    if (cp) {
      set({
        messages: [...cp.messages],
        openFiles: cp.openFiles.map((f) => ({ ...f })),
        activeFile: cp.activeFile,
      });
    }
  },
  deleteCheckpoint: (id) =>
    set((state) => ({
      checkpoints: state.checkpoints.filter((c) => c.id !== id),
    })),

  // Subagents
  subagents: [],
  addSubagent: (sub) => {
    const id = `sub-${Date.now()}`;
    set((state) => ({
      subagents: [
        ...state.subagents,
        {
          id,
          name: sub.name,
          goal: sub.goal,
          status: "running",
          parentId: sub.parentId,
          messages: [],
          createdAt: Date.now(),
        },
      ],
    }));
    return id;
  },
  updateSubagent: (id, updates) =>
    set((state) => ({
      subagents: state.subagents.map((s) =>
        s.id === id ? { ...s, ...updates } as typeof s : s
      ),
    })),
  removeSubagent: (id) =>
    set((state) => ({
      subagents: state.subagents.filter((s) => s.id !== id),
    })),

  // Custom commands - built-in slash commands
  customCommands: [
    { id: "cmd-help", name: "help", command: "__help__", description: "Yardım ve tüm komutları listele", isBuiltIn: true },
    { id: "cmd-clear", name: "clear", command: "__clear__", description: "Sohbeti temizle", isBuiltIn: true },
    { id: "cmd-model", name: "model", command: "__model__", description: "Model değiştir", isBuiltIn: true },
    { id: "cmd-cost", name: "cost", command: "__cost__", description: "Maliyet özeti", isBuiltIn: true },
    { id: "cmd-theme", name: "theme", command: "__theme__", description: "Tema değiştir", isBuiltIn: true },
    { id: "cmd-agent", name: "agent", command: "__agent__", description: "Agent modunu aç", isBuiltIn: true },
    { id: "cmd-compare", name: "compare", command: "__compare__", description: "Multi-provider karşılaştırma", isBuiltIn: true },
    { id: "cmd-checkpoint", name: "checkpoint", command: "__checkpoint__", description: "Checkpoint kaydet", isBuiltIn: true },
    { id: "cmd-restore", name: "restore", command: "__restore__", description: "Checkpoint geri yükle", isBuiltIn: true },
    { id: "cmd-export", name: "export", command: "__export__", description: "Sohbeti dışa aktar", isBuiltIn: true },
    { id: "cmd-review", name: "review", command: "__review__", description: "Code review yap", isBuiltIn: true },
    { id: "cmd-rag", name: "rag", command: "__rag__", description: "RAG panel aç", isBuiltIn: true },
    { id: "cmd-mcp", name: "mcp", command: "__mcp__", description: "MCP server paneli", isBuiltIn: true },
    { id: "cmd-snippet", name: "snippet", command: "__snippet__", description: "Snippet'leri listele", isBuiltIn: true },
    { id: "cmd-files", name: "files", command: "__files__", description: "Context dosyalarını göster", isBuiltIn: true },
    { id: "cmd-computer", name: "computer", command: "__computer__", description: "Computer Use - PC kontrolü (Claude Code gibi)", isBuiltIn: true },
  ],
  addCustomCommand: (cmd) =>
    set((state) => ({
      customCommands: [
        ...state.customCommands,
        {
          ...cmd,
          id: `cmd-${Date.now()}`,
          isBuiltIn: false,
        },
      ],
    })),
  removeCustomCommand: (id) =>
    set((state) => ({
      customCommands: state.customCommands.filter(
        (c) => c.id !== id || c.isBuiltIn
      ),
    })),

  // Permissions
  permissions: {
    autoApproveReads: true,
    autoApproveWrites: false,
    autoApproveBash: false,
    autoApproveSearch: true,
  },
  updatePermissions: (perms) =>
    set((state) => ({
      permissions: { ...state.permissions, ...perms },
    })),

  // Context files
  contextFiles: [],
  addContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.includes(path)
        ? state.contextFiles
        : [...state.contextFiles, path],
    })),
  removeContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.filter((p) => p !== path),
    })),
  clearContextFiles: () => set({ contextFiles: [] }),

  // =========== v9 NEW ===========
  // Pending images
  pendingImages: [],
  addPendingImage: (img) =>
    set((state) => ({ pendingImages: [...state.pendingImages, img] })),
  removePendingImage: (idx) =>
    set((state) => ({
      pendingImages: state.pendingImages.filter((_, i) => i !== idx),
    })),
  clearPendingImages: () => set({ pendingImages: [] }),

  // Reasoning mode
  reasoningMode: false,
  setReasoningMode: (v) => set({ reasoningMode: v }),

  // Budget limit
  budgetLimit: 0,
  setBudgetLimit: (v) => set({ budgetLimit: v }),
  budgetPeriod: "session",
  setBudgetPeriod: (p) => set({ budgetPeriod: p }),

  // Multi-chat tabs
  chatTabs: [{ id: "default", name: "Sohbet 1", messages: [] }],
  activeChatTabId: "default",
  setActiveChatTab: (id) => {
    const tab = get().chatTabs.find((t) => t.id === id);
    if (tab) {
      set({
        activeChatTabId: id,
        messages: tab.messages,
      });
    }
  },
  addChatTab: (name) => {
    const id = `chat-${Date.now()}`;
    const tab = {
      id,
      name: name ?? `Sohbet ${get().chatTabs.length + 1}`,
      messages: [],
    };
    set((state) => ({
      chatTabs: [...state.chatTabs, tab],
      activeChatTabId: id,
      messages: [],
    }));
  },
  removeChatTab: (id) => {
    set((state) => {
      if (state.chatTabs.length === 1) return state;
      const filtered = state.chatTabs.filter((t) => t.id !== id);
      const newActive =
        state.activeChatTabId === id ? filtered[0].id : state.activeChatTabId;
      const newMessages = filtered.find((t) => t.id === newActive)?.messages ?? [];
      return {
        chatTabs: filtered,
        activeChatTabId: newActive,
        messages: newMessages,
      };
    });
  },
  renameChatTab: (id, name) =>
    set((state) => ({
      chatTabs: state.chatTabs.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    })),

  // Status bar
  statusBarVisible: true,
  setStatusBarVisible: (v) => set({ statusBarVisible: v }),

  // =========== v10 Computer Use ===========
  computerUseOpen: false,
  setComputerUseOpen: (v) => set({ computerUseOpen: v }),
}));
